import { describe, expect, it } from 'vitest';
import {
  type Entry,
  accountBalance,
  categoryTotals,
  csv,
  demoLedger,
  emptyLedger,
  localDate,
  monthEntries,
  parseAmount,
  shiftMonth,
  totals,
  upsertEntry,
  validDate,
  validateLedger,
} from '../src/domain/ledger';

const expense: Entry = {
  id: 'one',
  kind: 'expense',
  amount: 1234,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-11-02',
  note: '午饭',
  createdAt: '2026-11-02T04:00:00.000Z',
};

describe('integer money', () => {
  it('parses decimal money exactly, without floating point rounding', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('123.4')).toBe(12340);
    expect(parseAmount('9999999.99')).toBe(999999999);
    expect(parseAmount('0', true)).toBe(0);
  });
  it.each(['0', '-1', '1.001', '1e5', 'Infinity', '10000000', 'abc', '', '.'])(
    'rejects invalid amount %s',
    (amount) => expect(() => parseAmount(amount)).toThrow(),
  );
});

describe('ledger integrity and balance', () => {
  it('starts with no sample entries', () =>
    expect(emptyLedger().entries).toEqual([]));
  it('opens older ledgers with account cards hidden and preserves financial data', () => {
    const current = demoLedger(new Date(2026, 10, 2));
    const { showAccountCards, ...legacy } = current;
    const loaded = validateLedger(JSON.parse(JSON.stringify(legacy)));
    expect(loaded.showAccountCards).toBe(false);
    expect(loaded.entries).toEqual(current.entries);
    expect(loaded.accounts).toEqual(current.accounts);
    expect(loaded.monthlyBudget).toBe(current.monthlyBudget);
    expect(
      validateLedger(
        JSON.parse(JSON.stringify({ ...loaded, showAccountCards: true })),
      ).showAccountCards,
    ).toBe(true);
  });
  it('recalculates balance and statistics after editing and deleting', () => {
    let ledger = upsertEntry(emptyLedger(), expense);
    expect(accountBalance(ledger, 'wechat')).toBe(-1234);
    ledger = upsertEntry(ledger, {
      ...expense,
      amount: 2999,
      accountId: 'bank',
    });
    expect(ledger.entries).toHaveLength(1);
    expect(accountBalance(ledger, 'wechat')).toBe(0);
    expect(accountBalance(ledger, 'bank')).toBe(-2999);
    expect(totals(ledger.entries)).toEqual({ income: 0, expense: 2999 });
    ledger.entries = [];
    expect(accountBalance(ledger, 'bank')).toBe(0);
  });
  it('moves money between accounts without increasing income or expenses', () => {
    const ledger = upsertEntry(emptyLedger(), {
      ...expense,
      kind: 'transfer',
      categoryId: 'transfer',
      toAccountId: 'alipay',
    });
    expect(accountBalance(ledger, 'wechat')).toBe(-1234);
    expect(accountBalance(ledger, 'alipay')).toBe(1234);
    expect(
      ledger.accounts.reduce((s, a) => s + accountBalance(ledger, a.id), 0),
    ).toBe(0);
    expect(totals(ledger.entries)).toEqual({ income: 0, expense: 0 });
    expect(categoryTotals(ledger.entries)).toEqual([]);
  });
  it('counts income and opening balances separately', () => {
    const data = emptyLedger();
    data.accounts[0]!.openingBalance = -100;
    const ledger = upsertEntry(data, {
      ...expense,
      kind: 'income',
      categoryId: 'salary',
    });
    expect(accountBalance(ledger, 'wechat')).toBe(1134);
    expect(totals(ledger.entries).income).toBe(1234);
  });
  it.each([
    { accountId: 'missing' },
    { kind: 'transfer', categoryId: 'transfer', toAccountId: 'wechat' },
    { kind: 'transfer', categoryId: 'transfer', toAccountId: 'missing' },
    { categoryId: 'salary' },
    { amount: 1.5 },
    { amount: 0 },
    { amount: -10 },
    { date: '2026-02-30' },
  ])('rejects invalid entry %j', (override) =>
    expect(() =>
      upsertEntry(emptyLedger(), { ...expense, ...override } as Entry),
    ).toThrow(),
  );
  it('rejects duplicate entry and account IDs, unsupported versions and invalid backups', () => {
    expect(() =>
      validateLedger({ ...emptyLedger(), entries: [expense, expense] }),
    ).toThrow();
    const data = emptyLedger();
    data.accounts.push(data.accounts[0]!);
    expect(() => validateLedger(data)).toThrow();
    expect(() => validateLedger({ ...emptyLedger(), version: 2 })).toThrow();
    expect(() =>
      validateLedger({ ...emptyLedger(), monthlyBudget: -1 }),
    ).toThrow();
    expect(() =>
      validateLedger({ ...emptyLedger(), showAccountCards: 'false' }),
    ).toThrow('账户显示设置无效');
    expect(() => validateLedger(null)).toThrow();
  });
  it('round trips a complete backup with exactly preserved values', () => {
    const ledger = demoLedger(new Date(2026, 10, 2));
    expect(validateLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
    expect(ledger.entries).toHaveLength(9);
    expect(monthEntries(ledger, '2026-11')).toHaveLength(9);
  });
  it('groups category totals without income or transfers', () => {
    const ledger = upsertEntry(upsertEntry(emptyLedger(), expense), {
      ...expense,
      id: 'two',
      kind: 'income',
      categoryId: 'salary',
      amount: 10000,
    });
    expect(categoryTotals(ledger.entries).map((c) => [c.id, c.total])).toEqual([
      ['food', 1234],
    ]);
  });
});

describe('calendar and export', () => {
  it('handles leap years and month/year boundaries using local dates', () => {
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2026-02-29')).toBe(false);
    expect(validDate('2026-13-01')).toBe(false);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(localDate(new Date(2026, 10, 2))).toBe('2026-11-02');
  });
  it('filters months and sorts newest dates first', () => {
    const ledger = emptyLedger();
    ledger.entries = [
      expense,
      { ...expense, id: 'two', date: '2026-11-03' },
      { ...expense, id: 'three', date: '2026-10-30' },
    ];
    expect(monthEntries(ledger, '2026-11').map((e) => e.id)).toEqual([
      'two',
      'one',
    ]);
  });
  it('escapes CSV quotes and spreadsheet formula prefixes', () => {
    const text = csv(
      upsertEntry(emptyLedger(), { ...expense, note: '=SUM(1,2)"\n你好' }),
    );
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text).toContain('"\'=SUM(1,2)""\n你好"');
    expect(text).toContain('"12.34"');
  });
});

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  type Entry,
  accountBalance,
  accountPeriodBalance,
  budgetPace,
  categoryTotals,
  csv,
  demoLedger,
  deleteEntry,
  emptyLedger,
  entryDefault,
  localDate,
  monthEntries,
  parseAmount,
  parseReconciliationBalance,
  restoreEntry,
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

describe('account reconciliation', () => {
  it('uses cash movement dates for refunds, both transfer directions, and period cutoffs', () => {
    const openingExpense = { ...expense, amount: 14000, date: '2026-10-26' };
    const incoming: Entry = {
      ...expense, id: 'in', kind: 'transfer', categoryId: 'transfer',
      accountId: 'bank', toAccountId: 'wechat', amount: 1000, date: '2026-11-06',
    };
    const entries: Entry[] = [
      openingExpense,
      { ...expense, id: 'refund', kind: 'refund', originalEntryId: expense.id, amount: 2500, date: '2026-11-05' },
      incoming,
      { ...incoming, id: 'out', accountId: 'wechat', toAccountId: 'bank', amount: 900, date: '2026-11-07' },
      { ...expense, id: 'future', amount: 500, date: '2026-11-30' },
    ];
    const account = { id: 'wechat', name: '微信', openingBalance: 10000 };
    expect(accountPeriodBalance(entries, account, '2026-11-01', '2026-11-20')).toEqual({
      opening: -4000, inflow: 3500, outflow: 900, closing: -1400,
    });
    expect(accountPeriodBalance(entries, account, '2026-11-01', '2026-11-30').closing)
      .toBe(accountBalance({ ...emptyLedger(), accounts: [account], entries }, account.id));
  });

  it('parses an actual balance exactly, including zero and negative aggregates', () => {
    expect(parseReconciliationBalance('  -14.01 ')).toBe(-1401);
    expect(parseReconciliationBalance('-0')).toBe(0);
    expect(parseReconciliationBalance('999999999999.99')).toBe(99_999_999_999_999);
    expect(() => parseReconciliationBalance('1.005')).toThrow('两位小数');
    expect(() => parseReconciliationBalance('1e5')).toThrow();
  });
});

describe('monthly budget pace', () => {
  it('includes today and rounds the daily allowance down to whole cents', () => {
    expect(budgetPace(30_001, 24_000, '2028-02-20')).toEqual({
      daysLeft: 10,
      dailyAllowance: 600,
      overPace: true,
    });
  });
  it('keeps the last day available and clamps an overspent budget to zero', () => {
    expect(budgetPace(1000, 1001, '2027-02-28')).toEqual({
      daysLeft: 1,
      dailyAllowance: 0,
      overPace: true,
    });
    expect(budgetPace(3000, 1000, '2026-11-10').overPace).toBe(false);
  });
});

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
  it('preserves archived accounts in backups and validates their status', () => {
    const ledger = upsertEntry(emptyLedger(), expense, true);
    ledger.accounts[0]!.archived = true;
    const restored = validateLedger(JSON.parse(JSON.stringify(ledger)));
    expect(restored.accounts[0]?.archived).toBe(true);
    expect(restored.entries).toEqual([expense]);
    expect(accountBalance(restored, 'wechat')).toBe(-1234);
    expect(entryDefault(restored, 'expense').accountId).toBe('alipay');
    expect(() =>
      validateLedger({
        ...restored,
        accounts: restored.accounts.map((account) => ({
          ...account,
          archived: true,
        })),
      }),
    ).toThrow('请至少保留一个可用账户');
    expect(() =>
      validateLedger({
        ...restored,
        accounts: [
          { ...restored.accounts[0], archived: 'true' },
          ...restored.accounts.slice(1),
        ],
      }),
    ).toThrow('账户归档状态无效');
  });
  it('allows historical edits and undo but rejects new postings to archived accounts', () => {
    const transfer: Entry = {
      ...expense,
      id: 'transfer-existing',
      kind: 'transfer',
      accountId: 'alipay',
      toAccountId: 'wechat',
      categoryId: 'transfer',
    };
    const ledger = upsertEntry(upsertEntry(emptyLedger(), expense), transfer);
    ledger.accounts[0]!.archived = true;
    expect(() => upsertEntry(ledger, { ...expense, id: 'repeat' })).toThrow(
      '已归档',
    );
    expect(() =>
      upsertEntry(ledger, { ...transfer, id: 'another-transfer' }),
    ).toThrow('已归档');
    expect(() =>
      upsertEntry(ledger, { ...expense, kind: 'income', categoryId: 'salary' }),
    ).toThrow('已归档');
    expect(
      upsertEntry(ledger, { ...expense, note: '补充备注' }).entries,
    ).toContainEqual({ ...expense, note: '补充备注' });
    expect(
      upsertEntry(ledger, { ...transfer, note: '历史转账' }).entries,
    ).toContainEqual({ ...transfer, note: '历史转账' });
    expect(
      restoreEntry(deleteEntry(ledger, transfer.id), transfer).entries,
    ).toContainEqual(transfer);
  });
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
    expect(() => validateLedger({ ...emptyLedger(), version: 99 })).toThrow();
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
  it('validates the same historical ledger dates in different device time zones', () => {
    const source = new URL('../src/domain/ledger.ts', import.meta.url).href;
    const ledger = {
      ...emptyLedger(),
      entries: [
        { ...expense, date: '2011-12-30' },
        { ...expense, id: 'two', date: '1994-12-31' },
      ],
    };
    const script = `
      import { daysInMonth, validateLedger } from ${JSON.stringify(source)};
      console.log(JSON.stringify({
        dates: validateLedger(JSON.parse(process.argv[1])).entries.map((entry) => entry.date),
        december1994: daysInMonth(1994, 12),
      }));
    `;
    for (const timezone of [
      'Asia/Shanghai', 'Pacific/Apia', 'Pacific/Kiritimati',
    ]) {
      const result = execFileSync(
        process.execPath,
        [
          '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
          '--input-type=module',
          '-e', script, JSON.stringify(ledger),
        ],
        { env: { ...process.env, TZ: timezone }, encoding: 'utf8' },
      );
      expect(JSON.parse(result)).toEqual({
        dates: ['2011-12-30', '1994-12-31'],
        december1994: 31,
      });
    }
  });
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

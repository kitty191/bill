import { describe, expect, it } from 'vitest';
import { calculateAmount } from '../src/domain/calculator';
import {
  calendarDays,
  monthRange,
  shiftDay,
  validMonth,
} from '../src/domain/dates';
import {
  budgetForMonth,
  emptyLedger,
  restoreEntry,
  upsertEntry,
  validateLedger,
  type Entry,
} from '../src/domain/ledger';
import {
  emptyFilters,
  filteredEntries,
  validateFilters,
  entryGroups,
} from '../src/domain/entryFilters';

const entry: Entry = {
  id: 'food',
  kind: 'expense',
  amount: 10000,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-10-31',
  note: '晚饭',
  createdAt: '2026-10-31T10:00:00Z',
};
describe('exact money calculator', () => {
  it.each([
    ['0.1+0.2', 30],
    ['(26+15)÷2', 2050],
    ['10/3', 333],
    ['1/8', 13],
    ['1/3*3', 100],
    ['2+3*4', 1400],
    ['(2+3)*4', 2000],
    ['-2+5', 300],
    ['10−2×3', 400],
    ['.5+.005', 51],
    ['9999999.99', 999999999],
  ])('%s produces %i integer cents', (source, amount) =>
    expect(calculateAmount(source)).toBe(amount),
  );
  it.each([
    '1/0',
    '0/(1-1)',
    '1-',
    '1..2',
    '()',
    '(1+2',
    '1+2)',
    '1(2)',
    'alert(1)',
    '1e3',
    '-1',
    '0',
    '10000000',
    '1/1000',
    '1+'.repeat(70),
    '('.repeat(18) + '1' + ')'.repeat(18),
  ])('rejects invalid or unsafe result %s', (source) =>
    expect(() => calculateAmount(source)).toThrow(),
  );
});
describe('calendar dates', () => {
  it('uses Monday-first aligned cells, including leap days', () => {
    const cells = calendarDays('2024-02');
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells).toContain('2024-02-29');
    expect(cells.length % 7).toBe(0);
    expect(calendarDays('2026-11').filter(Boolean)).toHaveLength(30);
  });
  it('shifts local calendar days across month/year and validates bounds', () => {
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(monthRange('2026-02')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    for (const month of [
      '2026-00',
      '2026-13',
      '1899-12',
      '2201-01',
      '__proto__',
    ])
      expect(validMonth(month)).toBe(false);
  });
});
describe('independent monthly budgets and migration', () => {
  it('preserves v2 financial data and the old budget as a fallback', () => {
    const source = {
      ...upsertEntry(emptyLedger(), entry),
      version: 2,
      monthlyBudget: 100000,
    };
    const loaded = validateLedger(source);
    expect(loaded.version).toBe(3);
    expect(loaded.entries).toEqual(source.entries);
    expect(loaded.monthBudgets).toEqual({});
    expect(budgetForMonth(loaded, '2026-10')).toBe(100000);
    const changed = validateLedger({
      ...loaded,
      monthBudgets: { '2026-10': 200000, '2026-11': 0 },
    });
    expect(budgetForMonth(changed, '2026-10')).toBe(200000);
    expect(budgetForMonth(changed, '2026-11')).toBe(0);
    expect(budgetForMonth(changed, '2026-12')).toBe(100000);
    expect(validateLedger(JSON.parse(JSON.stringify(changed)))).toEqual(
      changed,
    );
    expect(changed.entries).toEqual(source.entries);
  });
  it('rejects malformed budgets rather than silently changing their values', () => {
    for (const monthBudgets of [
      null,
      [],
      { '2026-13': 1 },
      { '2026-01': -1 },
      { '2026-01': 0.5 },
      { '2026-01': '10' },
      { '2201-01': 10 },
    ])
      expect(() =>
        validateLedger({ ...emptyLedger(), monthBudgets }),
      ).toThrow();
  });
});
describe('combined entry filtering', () => {
  const ledger = validateLedger({
    ...emptyLedger(),
    entries: [
      entry,
      {
        ...entry,
        id: 'other',
        date: '2026-11-02',
        accountId: 'alipay',
        categoryId: 'coffee',
      },
      {
        ...entry,
        id: 'transfer',
        kind: 'transfer',
        categoryId: 'transfer',
        toAccountId: 'bank',
        date: '2026-11-01',
      },
    ],
  });
  it('combines an inclusive cross-month range, account, category and search', () => {
    const filters = {
      ...emptyFilters(),
      range: true,
      startDate: '2026-10-31',
      endDate: '2026-11-02',
      categoryId: 'food',
      accountId: 'wechat',
    };
    expect(
      filteredEntries(ledger, '2026-11', 'expense', '晚饭', filters).map(
        (e) => e.id,
      ),
    ).toEqual(['food']);
    expect(
      filteredEntries(ledger, '2026-11', 'expense', '', emptyFilters()).map(
        (e) => e.id,
      ),
    ).toEqual(['other']);
    expect(
      filteredEntries(ledger, '2026-11', 'all', '', {
        ...filters,
        startDate: '2026-11-01',
      }),
    ).toEqual([]);
  });
  it('includes transfer destination accounts and hidden historical categories', () => {
    expect(
      filteredEntries(ledger, '2026-11', 'transfer', '', {
        ...emptyFilters(),
        accountId: 'bank',
      }).map((e) => e.id),
    ).toEqual(['transfer']);
    const hidden = validateLedger({
      ...ledger,
      categories: ledger.categories.map((c) =>
        c.id === 'coffee' ? { ...c, hidden: true } : c,
      ),
    });
    expect(
      filteredEntries(hidden, '2026-11', 'all', '咖啡', emptyFilters()).map(
        (e) => e.id,
      ),
    ).toEqual(['other']);
  });
  it('rejects impossible/reversed date ranges', () => {
    expect(() =>
      validateFilters({
        ...emptyFilters(),
        range: true,
        startDate: '2026-11-02',
        endDate: '2026-11-01',
      }),
    ).toThrow('开始日期');
    expect(() =>
      validateFilters({
        ...emptyFilters(),
        range: true,
        startDate: '2026-02-30',
        endDate: '2026-03-01',
      }),
    ).toThrow('有效');
  });
});
describe('restore deletion integrity', () => {
  it('groups cross-month records once and attributes refunds to the original expense day', () => {
    const refund: Entry = {
      ...entry,
      id: 'refund',
      kind: 'refund',
      amount: 3000,
      originalEntryId: entry.id,
      date: '2026-11-02',
    };
    const all = [refund, entry];
    const groups = entryGroups(all, all);
    expect(groups.map((group) => group.date)).toEqual([
      '2026-11-02',
      '2026-10-31',
    ]);
    expect(groups.map((group) => group.expense)).toEqual([0, 7000]);
    expect(entryGroups([entry], all)[0]!.expense).toBe(7000);
  });
  it('rejects collision and missing refund references without replacing newer records', () => {
    const ledger = upsertEntry(emptyLedger(), entry);
    expect(() => restoreEntry(ledger, { ...entry, amount: 200 })).toThrow(
      '已存在',
    );
    const refund: Entry = {
      ...entry,
      id: 'refund',
      kind: 'refund',
      originalEntryId: entry.id,
    };
    expect(() => restoreEntry(emptyLedger(), refund)).toThrow('原支出');
    expect(restoreEntry(emptyLedger(), entry).entries).toEqual([entry]);
  });
});

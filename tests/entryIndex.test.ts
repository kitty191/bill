import { expect, it } from 'vitest';
import { emptyLedger, type Entry } from '../src/domain/ledger';
import {
  buildEntryIndex,
  emptyFilters,
  filterEntryIndex,
} from '../src/domain/entryFilters';

it('reuses a sorted search projection without changing source order or dropping records from large totals', () => {
  const ledger = emptyLedger();
  ledger.entries = Array.from(
    { length: 10000 },
    (_, i): Entry => ({
      id: `e-${i}`,
      kind: 'expense',
      amount: 100,
      categoryId: 'food',
      accountId: 'wechat',
      date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      note: `记录-${i}`,
      createdAt: new Date(Date.UTC(2026, 10, 28) - i * 1000).toISOString(),
    }),
  );
  const index = buildEntryIndex(ledger);
  expect(ledger.entries[0]!.id).toBe('e-0');
  const all = filterEntryIndex(index, '2026-11', 'all', '', emptyFilters());
  expect(all).toHaveLength(10000);
  expect(all[0]!.id).toBe('e-27');
  expect(all.at(-1)!.id).toBe('e-9996');
  expect(all.reduce((sum, item) => sum + item.amount, 0)).toBe(1000000);
  expect(
    filterEntryIndex(
      index,
      '2026-11',
      'all',
      '  记录-9999 ',
      emptyFilters(),
    ).map((item) => item.id),
  ).toEqual(['e-9999']);
  expect(
    filterEntryIndex(index, '2026-11', 'all', '不存在', emptyFilters()),
  ).toEqual([]);
  expect(filterEntryIndex(index, '2026-11', 'all', '', emptyFilters())).toEqual(
    all,
  );
});

it('indexes hidden category and destination account names, and rebuilds correctly after their names change', () => {
  const ledger = emptyLedger();
  ledger.categories = ledger.categories.map((item) =>
    item.id === 'food' ? { ...item, hidden: true, label: '旧餐饮' } : item,
  );
  ledger.entries = [
    {
      id: 'food',
      kind: 'expense',
      amount: 100,
      categoryId: 'food',
      accountId: 'wechat',
      date: '2026-11-01',
      note: '',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'move',
      kind: 'transfer',
      amount: 200,
      categoryId: 'transfer',
      accountId: 'wechat',
      toAccountId: 'bank',
      date: '2026-10-31',
      note: '',
      createdAt: '2026-10-31T00:00:00Z',
    },
  ];
  const index = buildEntryIndex(ledger);
  expect(
    filterEntryIndex(index, '2026-11', 'expense', '旧餐饮', emptyFilters()).map(
      (item) => item.id,
    ),
  ).toEqual(['food']);
  const range = {
    ...emptyFilters(),
    range: true,
    startDate: '2026-10-31',
    endDate: '2026-11-01',
    accountId: 'bank',
  };
  expect(
    filterEntryIndex(index, 'ignored', 'transfer', '银行卡', range).map(
      (item) => item.id,
    ),
  ).toEqual(['move']);
  const renamed = {
    ...ledger,
    accounts: ledger.accounts.map((item) =>
      item.id === 'bank' ? { ...item, name: '储蓄' } : item,
    ),
  };
  expect(
    filterEntryIndex(buildEntryIndex(renamed), '', 'all', '储蓄', range).map(
      (item) => item.id,
    ),
  ).toEqual(['move']);
  expect(
    filterEntryIndex(buildEntryIndex(renamed), '', 'all', '银行卡', range),
  ).toEqual([]);
});

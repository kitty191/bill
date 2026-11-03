import { describe, expect, it } from 'vitest';
import {
  type Entry,
  accountBalance,
  categoryTotals,
  csv,
  deleteEntry,
  demoLedger,
  emptyLedger,
  entryDefault,
  monthEntries,
  remainingRefund,
  totals,
  upsertEntry,
  validateLedger,
  visibleCategories,
} from '../src/domain/ledger';
import { annualSummary } from '../src/domain/annual';
import { dailyExpenseValues } from '../src/domain/expenseTrend';
import {
  backupReminderDue,
  defaultPreferences,
  validatePreferences,
} from '../src/domain/privacy';

const expense: Entry = {
  id: 'expense',
  kind: 'expense',
  amount: 10000,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2025-12-10',
  note: '原支出',
  createdAt: '2025-12-10T12:00:00Z',
};
const refund: Entry = {
  id: 'refund',
  kind: 'refund',
  amount: 3000,
  categoryId: 'food',
  accountId: 'bank',
  originalEntryId: 'expense',
  date: '2026-01-05',
  note: '部分退回',
  createdAt: '2026-01-05T12:00:00Z',
};

describe('version 1 migration and category integrity', () => {
  it('migrates all old financial values without inventing transactions', () => {
    const source = demoLedger(new Date(2026, 10, 3));
    const legacy = {
      version: 1,
      accounts: source.accounts,
      entries: source.entries,
      monthlyBudget: source.monthlyBudget,
      showAccountCards: true,
    };
    const loaded = validateLedger(JSON.parse(JSON.stringify(legacy)));
    expect(loaded.version).toBe(2);
    expect(loaded.entries).toEqual(legacy.entries);
    expect(loaded.accounts).toEqual(legacy.accounts);
    expect(loaded.monthlyBudget).toBe(legacy.monthlyBudget);
    expect(loaded.showAccountCards).toBe(true);
    expect(loaded.templates).toEqual([]);
    expect(loaded.defaults).toEqual({});
    expect(totals(loaded.entries)).toEqual(totals(source.entries));
    for (const account of source.accounts)
      expect(accountBalance(loaded, account.id)).toBe(
        accountBalance(source, account.id),
      );
  });
  it('keeps renamed or hidden classifications in historical records and export', () => {
    let ledger = upsertEntry(emptyLedger(), expense);
    ledger = validateLedger({
      ...ledger,
      categories: ledger.categories.map((c) =>
        c.id === 'food' ? { ...c, label: '日常吃饭', hidden: true } : c,
      ),
    });
    expect(
      visibleCategories(ledger, 'expense').some((c) => c.id === 'food'),
    ).toBe(false);
    expect(categoryTotals(ledger.entries, ledger.categories)[0]?.label).toBe(
      '日常吃饭',
    );
    expect(csv(ledger)).toContain('日常吃饭');
  });
  it('accepts custom categories and rejects duplicate IDs, wrong kinds and invalid styles', () => {
    const ledger = emptyLedger();
    const custom = {
      id: 'custom',
      kind: 'expense',
      hidden: false,
      label: '宠物',
      icon: 'heart',
      color: '#D7838B',
    };
    const next = validateLedger({
      ...ledger,
      categories: [...ledger.categories, custom],
    });
    expect(
      upsertEntry(next, { ...expense, categoryId: 'custom' }).entries[0]!
        .categoryId,
    ).toBe('custom');
    expect(() =>
      validateLedger({ ...next, categories: [...next.categories, custom] }),
    ).toThrow();
    expect(() =>
      validateLedger({
        ...ledger,
        categories: [...ledger.categories, { ...custom, color: 'red' }],
      }),
    ).toThrow('分类颜色无效');
    expect(() =>
      validateLedger({
        ...ledger,
        categories: ledger.categories.map((c) => ({ ...c, hidden: true })),
      }),
    ).toThrow('至少保留');
  });
  it('remembers account and classification, skips hidden defaults and round trips templates', () => {
    let ledger = upsertEntry(
      emptyLedger(),
      { ...expense, accountId: 'alipay', categoryId: 'coffee' },
      true,
    );
    expect(entryDefault(ledger, 'expense')).toEqual({
      accountId: 'alipay',
      categoryId: 'coffee',
    });
    ledger = validateLedger({
      ...ledger,
      categories: ledger.categories.map((c) =>
        c.id === 'coffee' ? { ...c, hidden: true } : c,
      ),
      templates: [
        {
          id: 'breakfast',
          name: '早餐',
          kind: 'expense',
          amount: 1500,
          accountId: 'alipay',
          categoryId: 'food',
          note: '早餐',
        },
      ],
    });
    expect(entryDefault(ledger, 'expense')).toEqual({
      accountId: 'alipay',
      categoryId: 'food',
    });
    expect(validateLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
    expect(() =>
      validateLedger({
        ...ledger,
        templates: [{ ...ledger.templates[0], accountId: 'missing' }],
      }),
    ).toThrow('账户无效');
    expect(() =>
      validateLedger({
        ...ledger,
        templates: [{ ...ledger.templates[0], amount: 0 }],
      }),
    ).toThrow('金额无效');
  });
});

describe('linked refunds', () => {
  it('credits the receiving account and reduces the original expense period, never income', () => {
    const ledger = upsertEntry(upsertEntry(emptyLedger(), expense), refund);
    expect(accountBalance(ledger, 'wechat')).toBe(-10000);
    expect(accountBalance(ledger, 'bank')).toBe(3000);
    expect(totals(monthEntries(ledger, '2025-12'), ledger.entries)).toEqual({
      income: 0,
      expense: 7000,
    });
    expect(totals(monthEntries(ledger, '2026-01'), ledger.entries)).toEqual({
      income: 0,
      expense: 0,
    });
    expect(
      categoryTotals(
        monthEntries(ledger, '2025-12'),
        ledger.categories,
        ledger.entries,
      )[0]!.total,
    ).toBe(7000);
    expect(dailyExpenseValues(ledger.entries, '2025-12', '2026-01-06')[9]).toBe(
      7000,
    );
    expect(remainingRefund(ledger, expense)).toBe(7000);
    expect(csv(ledger)).toContain('"退款"');
    expect(csv(ledger)).toContain('"关联原账单"');
  });
  it('supports multiple and edited refunds up to the exact original amount', () => {
    let ledger = upsertEntry(upsertEntry(emptyLedger(), expense), refund);
    ledger = upsertEntry(ledger, { ...refund, id: 'refund-2', amount: 7000 });
    expect(remainingRefund(ledger, expense)).toBe(0);
    expect(totals(ledger.entries).expense).toBe(0);
    expect(() =>
      upsertEntry(ledger, { ...refund, id: 'refund-3', amount: 1 }),
    ).toThrow('累计退款');
    ledger = upsertEntry(ledger, { ...refund, amount: 2000 });
    expect(remainingRefund(ledger, expense)).toBe(1000);
    expect(validateLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
  });
  it.each([
    { originalEntryId: 'missing' },
    { originalEntryId: 'refund' },
    { date: '2025-12-09' },
    { categoryId: 'coffee' },
    { amount: 10001 },
  ])('rejects invalid refunds %j', (override) => {
    const ledger = upsertEntry(emptyLedger(), expense);
    expect(() => upsertEntry(ledger, { ...refund, ...override })).toThrow();
  });
  it('protects original transactions from deletion, type changes and excessive reduction', () => {
    let ledger = upsertEntry(upsertEntry(emptyLedger(), expense), refund);
    expect(() => deleteEntry(ledger, expense.id)).toThrow('关联退款');
    expect(() => upsertEntry(ledger, { ...expense, amount: 2999 })).toThrow(
      '累计退款',
    );
    expect(() =>
      upsertEntry(ledger, { ...expense, kind: 'income', categoryId: 'salary' }),
    ).toThrow();
    ledger = upsertEntry(ledger, { ...expense, categoryId: 'coffee' });
    expect(ledger.entries.find((e) => e.id === refund.id)!.categoryId).toBe(
      'coffee',
    );
    ledger = deleteEntry(ledger, refund.id);
    expect(totals(ledger.entries).expense).toBe(10000);
    expect(deleteEntry(ledger, expense.id).entries).toEqual([]);
  });
});

describe('annual statistics', () => {
  it('calculates monthly totals, average, prior matching months and category comparisons', () => {
    let ledger = emptyLedger();
    for (const entry of [
      { ...expense, id: 'jan', date: '2026-01-02', amount: 12000 },
      { ...expense, id: 'feb', date: '2026-02-02', amount: 6000 },
      { ...expense, id: 'prior', date: '2025-01-02', amount: 9000 },
      { ...expense, id: 'prior-dec', date: '2025-12-02', amount: 99900 },
      {
        ...expense,
        id: 'salary',
        kind: 'income' as const,
        categoryId: 'salary',
        date: '2026-01-02',
        amount: 50000,
      },
    ])
      ledger = upsertEntry(ledger, entry);
    const stats = annualSummary(ledger, 2026, '2026-03-10');
    expect(stats.observedMonths).toBe(3);
    expect(stats.expense).toBe(18000);
    expect(stats.income).toBe(50000);
    expect(stats.averageExpense).toBe(6000);
    expect(stats.previousExpense).toBe(9000);
    expect(stats.monthly[0]).toMatchObject({
      expense: 12000,
      income: 50000,
      net: 38000,
    });
    expect(stats.monthly[2]!.expense).toBe(0);
    expect(stats.categories[0]).toMatchObject({
      id: 'food',
      total: 18000,
      previous: 9000,
    });
  });
  it('handles empty, completed, future and cross-year refunded years', () => {
    const ledger = upsertEntry(upsertEntry(emptyLedger(), expense), refund);
    expect(annualSummary(ledger, 2025, '2026-03-10')).toMatchObject({
      observedMonths: 12,
      expense: 7000,
    });
    expect(annualSummary(ledger, 2026, '2026-03-10')).toMatchObject({
      income: 0,
      expense: 0,
    });
    expect(annualSummary(emptyLedger(), 2027, '2026-03-10')).toMatchObject({
      observedMonths: 1,
      averageExpense: 0,
    });
    const future = upsertEntry(emptyLedger(), {
      ...expense,
      date: '2027-09-10',
    });
    expect(annualSummary(future, 2027, '2026-03-10').observedMonths).toBe(9);
  });
});

describe('device-only privacy and backup reminders', () => {
  it('defaults optional controls off and rejects corrupted security fields', () => {
    const defaults = defaultPreferences();
    expect(defaults.appLockEnabled).toBe(false);
    expect(defaults.hideAmounts).toBe(false);
    expect(defaults.backupReminderDays).toBe(0);
    expect(validatePreferences(JSON.parse(JSON.stringify(defaults)))).toEqual(
      defaults,
    );
    expect(() =>
      validatePreferences({ ...defaults, appLockEnabled: 'false' }),
    ).toThrow();
    expect(() =>
      validatePreferences({ ...defaults, lastExportAt: 'not-a-date' }),
    ).toThrow();
    expect(() =>
      validatePreferences({ ...defaults, backupReminderDays: 1 }),
    ).toThrow();
  });
  it('reminds after the selected interval, postpones once and resets after export', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    const preferences = {
      ...defaultPreferences(),
      backupReminderDays: 7 as const,
      reminderStartedAt: '2026-11-01T12:00:00Z',
    };
    expect(backupReminderDue(preferences, now)).toBe(true);
    expect(
      backupReminderDue(
        { ...preferences, snoozeUntil: '2026-11-11T12:00:00Z' },
        now,
      ),
    ).toBe(false);
    expect(
      backupReminderDue(
        { ...preferences, lastExportAt: '2026-11-09T12:00:00Z' },
        now,
      ),
    ).toBe(false);
    expect(
      backupReminderDue({ ...preferences, backupReminderDays: 0 }, now),
    ).toBe(false);
    expect(
      backupReminderDue(preferences, Date.parse('2026-10-01T12:00:00Z')),
    ).toBe(false);
  });
});

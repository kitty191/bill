import { describe, expect, it } from 'vitest';
import {
  emptyLedger,
  validateLedger,
  type Entry,
  type RecurringBill,
} from '../src/domain/ledger';
import {
  advanceRecurring,
  confirmRecurring,
  dueRecurring,
  nextOccurrence,
} from '../src/domain/recurring';

const bill: RecurringBill = {
  id: 'rent',
  name: '房租',
  kind: 'expense',
  amount: 200000,
  accountId: 'wechat',
  categoryId: 'home',
  note: '房租',
  enabled: true,
  cadence: 'monthly',
  anchorDate: '2026-01-31',
  nextDate: '2026-01-31',
};
const entry: Entry = {
  id: 'paid',
  kind: 'expense',
  amount: 190000,
  accountId: 'wechat',
  categoryId: 'home',
  note: '已确认房租',
  date: '2026-02-01',
  createdAt: '2026-02-01T04:00:00Z',
};
const book = () => ({
  ...emptyLedger(),
  recurringEnabled: true,
  recurringBills: [bill],
});
describe('recurring reminders and calendar anchoring', () => {
  it.each([
    { cadence: 'monthly', nextDate: '2026-03-30' },
    { cadence: 'yearly', nextDate: '2027-02-28' },
    { cadence: 'weekly', nextDate: '2026-02-01' },
  ])(
    'rejects a next date that does not match its recurrence anchor %j',
    (change) => {
      expect(() =>
        validateLedger({ ...book(), recurringBills: [{ ...bill, ...change }] }),
      ).toThrow('基准');
    },
  );
  it('keeps reminders off and transactions empty during old-book migration', () => {
    for (const version of [1, 2, 3]) {
      const legacy = {
        ...emptyLedger(),
        version,
        monthBudgets: { '2026-01': 10000 },
      };
      const upgraded = validateLedger(legacy);
      expect(upgraded.version).toBe(4);
      expect(upgraded.recurringEnabled).toBe(false);
      expect(upgraded.recurringBills).toEqual([]);
      expect(upgraded.entries).toEqual([]);
      expect(upgraded.monthBudgets).toEqual(
        version === 3 ? legacy.monthBudgets : {},
      );
    }
  });
  it('only returns enabled rules that are due, in stable date order, without creating transactions', () => {
    const ledger = book();
    ledger.recurringBills.push(
      { ...bill, id: 'future', nextDate: '2026-02-28' },
      { ...bill, id: 'paused', enabled: false },
    );
    expect(dueRecurring(ledger, '2026-01-30')).toEqual([]);
    expect(dueRecurring(ledger, '2026-01-31').map((item) => item.id)).toEqual([
      'rent',
    ]);
    expect(
      dueRecurring({ ...ledger, recurringEnabled: false }, '2027-01-01'),
    ).toEqual([]);
    expect(ledger.entries).toEqual([]);
  });
  it('clamps month ends without drifting from the original day', () => {
    expect(nextOccurrence(bill)).toBe('2026-02-28');
    expect(nextOccurrence({ ...bill, nextDate: '2026-02-28' })).toBe(
      '2026-03-31',
    );
    expect(nextOccurrence({ ...bill, nextDate: '2026-12-31' })).toBe(
      '2027-01-31',
    );
    expect(nextOccurrence({ ...bill, nextDate: '2028-01-31' })).toBe(
      '2028-02-29',
    );
  });
  it('handles leap-year yearly rules, weekly year boundaries and the supported final year', () => {
    const yearly = {
      ...bill,
      cadence: 'yearly' as const,
      anchorDate: '2024-02-29',
      nextDate: '2027-02-28',
    };
    expect(nextOccurrence(yearly)).toBe('2028-02-29');
    expect(nextOccurrence({ ...yearly, nextDate: '2028-02-29' })).toBe(
      '2029-02-28',
    );
    expect(
      nextOccurrence({ ...bill, cadence: 'weekly', nextDate: '2026-12-28' }),
    ).toBe('2027-01-04');
    expect(nextOccurrence({ ...bill, nextDate: '2200-12-31' })).toBeNull();
  });
  it('atomically records only the confirmed amount and date and advances exactly one occurrence', () => {
    const original = book();
    const saved = confirmRecurring(
      original,
      bill.id,
      bill.nextDate,
      entry,
      '2026-02-01',
    );
    expect(saved.entries).toEqual([
      { ...entry, recurringId: bill.id, recurringDate: bill.nextDate },
    ]);
    expect(saved.recurringBills[0]!.nextDate).toBe('2026-02-28');
    expect(original.entries).toEqual([]);
    expect(original.recurringBills[0]!.nextDate).toBe('2026-01-31');
    expect(validateLedger(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(() =>
      confirmRecurring(
        saved,
        bill.id,
        bill.nextDate,
        { ...entry, id: 'duplicate' },
        '2026-02-01',
      ),
    ).toThrow('账期');
  });
  it('blocks duplicates even if an imported or edited rule is moved to an already paid occurrence', () => {
    const saved = confirmRecurring(
      book(),
      bill.id,
      bill.nextDate,
      entry,
      '2026-02-01',
    );
    const moved = { ...saved, recurringBills: [bill] };
    expect(() =>
      confirmRecurring(
        moved,
        bill.id,
        bill.nextDate,
        { ...entry, id: 'second' },
        '2026-02-01',
      ),
    ).toThrow('已经记账');
    expect(() =>
      validateLedger({
        ...saved,
        entries: [...saved.entries, { ...saved.entries[0], id: 'copy' }],
      }),
    ).toThrow('重复记账');
  });
  it('skips without financial changes and rejects stale, future, paused or removed rules', () => {
    const skipped = advanceRecurring(
      book(),
      bill.id,
      bill.nextDate,
      '2026-01-31',
    );
    expect(skipped.entries).toEqual([]);
    expect(skipped.recurringBills[0]!.nextDate).toBe('2026-02-28');
    expect(() =>
      advanceRecurring(skipped, bill.id, bill.nextDate, '2026-02-01'),
    ).toThrow('账期');
    expect(() =>
      advanceRecurring(book(), bill.id, bill.nextDate, '2026-01-30'),
    ).toThrow('账期');
    expect(() =>
      advanceRecurring(
        { ...book(), recurringEnabled: false },
        bill.id,
        bill.nextDate,
      ),
    ).toThrow('关闭');
    expect(() =>
      advanceRecurring(
        { ...book(), recurringBills: [] },
        bill.id,
        bill.nextDate,
      ),
    ).toThrow('关闭');
  });
  it.each([
    { amount: 0 },
    { amount: 1.5 },
    { cadence: 'daily' },
    { nextDate: '2026-02-30' },
    { nextDate: '2025-01-01' },
    { categoryId: 'salary' },
    { accountId: 'missing' },
    { enabled: 'yes' },
    { name: '' },
  ])('rejects malformed rules %j', (change) => {
    expect(() =>
      validateLedger({ ...book(), recurringBills: [{ ...bill, ...change }] }),
    ).toThrow();
  });
  it('retains historical confirmation metadata after the rule is deleted', () => {
    const saved = confirmRecurring(
      book(),
      bill.id,
      bill.nextDate,
      entry,
      '2026-02-01',
    );
    expect(validateLedger({ ...saved, recurringBills: [] }).entries).toEqual(
      saved.entries,
    );
    expect(() =>
      validateLedger({
        ...saved,
        entries: [{ ...entry, recurringId: bill.id }],
      }),
    ).toThrow('关联');
  });
});

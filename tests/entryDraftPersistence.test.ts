import { expect, it } from 'vitest';
import {
  draftIdentity,
  parseEntryDraft,
  resumeEntryDraft,
  type EntryDraft,
} from '../src/domain/entryDraft';
import { emptyLedger, type Entry, type Ledger } from '../src/domain/ledger';
import { calculatorDraft } from '../src/domain/calculator';
import {
  emptyFilters,
  filteredEntries,
  validateFilters,
} from '../src/domain/entryFilters';
const entry: Entry = {
  id: 'coffee',
  kind: 'expense',
  amount: 2850,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-11-05',
  note: '拿铁',
  createdAt: '2026-11-05T01:00:00Z',
};
const ledger: Ledger = { ...emptyLedger(), entries: [entry] };
function draft(intent = {}): EntryDraft {
  return {
    ...draftIdentity(intent, ledger),
    fields: {
      kind: 'expense',
      calculator: { ...calculatorDraft('28.5+'), fresh: false },
      categoryId: 'food',
      accountId: 'wechat',
      toAccountId: 'alipay',
      date: '2026-',
      note: '未完成',
      saveTemplate: true,
      templateName: '咖啡',
    },
  };
}
it('roundtrips incomplete input without booking anything and keeps a stable new record identity', () => {
  const value = draft();
  expect(parseEntryDraft(JSON.stringify(value))).toEqual(value);
  expect(resumeEntryDraft(value, ledger)).toEqual({});
  expect(ledger.entries).toEqual([entry]);
  expect(value.recordId).not.toBe(entry.id);
  expect(() =>
    resumeEntryDraft(value, {
      ...ledger,
      entries: [...ledger.entries, { ...entry, id: value.recordId }],
    }),
  ).toThrow('已变化');
});
it('restores edits only against their original committed record and rejects deleted or changed references', () => {
  const value = draft({ entry });
  expect(resumeEntryDraft(value, ledger)).toEqual({ entry });
  expect(() => resumeEntryDraft(value, { ...ledger, entries: [] })).toThrow(
    '已变化',
  );
  expect(() =>
    resumeEntryDraft(value, {
      ...ledger,
      entries: [{ ...entry, amount: 3000 }],
    }),
  ).toThrow('已变化');
  expect(() => resumeEntryDraft(draft(), { ...ledger, accounts: [] })).toThrow(
    '已变化',
  );
});
it('resumes a refund with its actual expense, without inheriting periodic confirmation identity', () => {
  const value = draft({ refundOf: entry });
  value.fields.kind = 'refund';
  expect(resumeEntryDraft(value, ledger)).toEqual({ refundOf: entry });
  expect(() => resumeEntryDraft(value, { ...ledger, entries: [] })).toThrow(
    '已变化',
  );
});
it('rejects malformed and unbounded saved input while retaining valid unfinished expressions', () => {
  const value = draft();
  for (const raw of [
    'null',
    '{}',
    '{',
    JSON.stringify({
      ...value,
      fields: { ...value.fields, note: 'x'.repeat(121) },
    }),
    'x'.repeat(12001),
  ])
    expect(() => parseEntryDraft(raw)).toThrow('无法读取');
  value.fields.calculator.error = 'untrusted';
  expect(parseEntryDraft(JSON.stringify(value)).fields.calculator.error).toBe(
    '',
  );
});
it('matches exact cent amounts or existing text and combines inclusive bounds with other conditions', () => {
  const book = {
    ...ledger,
    entries: [
      entry,
      { ...entry, id: 'other', amount: 2900, note: '订单28.50' },
      { ...entry, id: 'third', amount: 2851, note: '美式' },
    ],
  };
  expect(
    filteredEntries(book, '2026-11', 'all', '28.50', emptyFilters()).map(
      (e) => e.id,
    ),
  ).toEqual(['coffee', 'other']);
  expect(
    filteredEntries(book, '2026-11', 'all', '¥28.50', emptyFilters()).map(
      (e) => e.id,
    ),
  ).toEqual(['coffee']);
  expect(
    filteredEntries(book, '2026-11', 'expense', '', {
      ...emptyFilters(),
      minAmount: '28.50',
      maxAmount: '28.51',
      categoryId: 'food',
    }).map((e) => e.id),
  ).toEqual(['coffee', 'third']);
  expect(
    filteredEntries(book, '2026-11', 'income', '', {
      ...emptyFilters(),
      minAmount: '0',
    }),
  ).toEqual([]);
  expect(() =>
    validateFilters({ ...emptyFilters(), minAmount: '29', maxAmount: '28.5' }),
  ).toThrow('最低金额');
  expect(() =>
    validateFilters({ ...emptyFilters(), minAmount: '0.001' }),
  ).toThrow();
});

it('restores due periodic confirmation without advancing it, and rejects changed or paused rules', () => {
  const book: Ledger = {
    ...ledger,
    recurringEnabled: true,
    recurringBills: [
      {
        id: 'rent',
        name: '房租',
        kind: 'expense',
        amount: 10000,
        categoryId: 'food',
        accountId: 'wechat',
        note: '',
        enabled: true,
        cadence: 'monthly',
        anchorDate: '2020-01-01',
        nextDate: '2020-01-01',
      },
    ],
  };
  const value = {
    ...draft(),
    ...draftIdentity(
      { recurringId: 'rent', recurringDate: '2020-01-01' },
      book,
    ),
  };
  expect(resumeEntryDraft(value, book)).toEqual({
    recurringId: 'rent',
    recurringDate: '2020-01-01',
  });
  expect(book.recurringBills[0]!.nextDate).toBe('2020-01-01');
  expect(book.entries).toHaveLength(1);
  expect(() =>
    resumeEntryDraft(value, { ...book, recurringEnabled: false }),
  ).toThrow('已变化');
  expect(() =>
    resumeEntryDraft(value, {
      ...book,
      recurringBills: [{ ...book.recurringBills[0]!, nextDate: '2020-02-01' }],
    }),
  ).toThrow('已变化');
});

import { expect, it } from 'vitest';
import { emptyFilters } from '../src/domain/entryFilters';
import { emptyLedger } from '../src/domain/ledger';
import {
  type SavedEntryFilter,
  parseSavedEntryFilters,
  resolveSavedEntryFilter,
} from '../src/domain/savedEntryFilters';

const saved: SavedEntryFilter = {
  id: 'test',
  name: '报销支出',
  kind: 'expense',
  query: '报销',
  filters: {
    ...emptyFilters(),
    range: true,
    startDate: '2027-01-01',
    endDate: '2027-01-31',
  },
};

it('keeps matching custom dates fixed and refreshes explicitly relative dates', () => {
  const ledger = emptyLedger();
  const previous: SavedEntryFilter = {
    ...saved,
    id: 'previous',
    filters: { ...saved.filters, datePreset: 'previous' },
  };
  const [custom, relative] = parseSavedEntryFilters(
    JSON.stringify([saved, previous]),
  );
  expect(resolveSavedEntryFilter(custom!, '2028-03-02', ledger)).toMatchObject({
    startDate: '2027-01-01',
    endDate: '2027-01-31',
  });
  expect(resolveSavedEntryFilter(relative!, '2028-03-02', ledger)).toMatchObject({
    startDate: '2028-02-01',
    endDate: '2028-02-29',
  });
});

it('refuses to broaden a filter whose account disappeared after a restore', () => {
  expect(() =>
    resolveSavedEntryFilter(
      { ...saved, filters: { ...saved.filters, accountId: 'missing' } },
      '2028-03-02',
      emptyLedger(),
    ),
  ).toThrow('账户已不存在');
});

it('rejects malformed filters before they can change the active results', () => {
  expect(() => parseSavedEntryFilters(JSON.stringify([saved, saved]))).toThrow();
  const invalid = {
    ...saved,
    filters: { ...saved.filters, startDate: '2027-01-32' },
  };
  expect(() => parseSavedEntryFilters(JSON.stringify([invalid]))).toThrow(
    '有效的开始日期',
  );
});

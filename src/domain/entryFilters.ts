import {
  type Ledger,
  type EntryKind,
  monthEntries,
  categoryFor,
  validDate,
  refundAmounts,
  type Entry,
} from './ledger';

export type EntryFilters = {
  range: boolean;
  startDate: string;
  endDate: string;
  categoryId: string;
  accountId: string;
};
export const emptyFilters = (): EntryFilters => ({
  range: false,
  startDate: '',
  endDate: '',
  categoryId: 'all',
  accountId: 'all',
});
export function validateFilters(filters: EntryFilters) {
  if (
    filters.range &&
    (!validDate(filters.startDate) || !validDate(filters.endDate))
  )
    throw new Error('请选择有效的开始和结束日期');
  if (filters.range && filters.startDate > filters.endDate)
    throw new Error('开始日期不能晚于结束日期');
  return filters;
}

export function entryGroups(entries: Entry[], allEntries: Entry[]) {
  const refunds = refundAmounts(allEntries);
  const groups = new Map<
    string,
    { date: string; entries: Entry[]; income: number; expense: number }
  >();
  for (const entry of entries) {
    let group = groups.get(entry.date);
    if (!group) {
      group = { date: entry.date, entries: [], income: 0, expense: 0 };
      groups.set(entry.date, group);
    }
    group.entries.push(entry);
    if (entry.kind === 'income') group.income += entry.amount;
    if (entry.kind === 'expense')
      group.expense += entry.amount - (refunds.get(entry.id) ?? 0);
  }
  return [...groups.values()];
}
export function filteredEntries(
  ledger: Ledger,
  month: string,
  kind: EntryKind | 'all',
  query: string,
  filters: EntryFilters,
) {
  validateFilters(filters);
  const accounts = new Map(
    ledger.accounts.map((account) => [account.id, account.name]),
  );
  const needle = query.trim().toLowerCase();
  const source = filters.range ? ledger.entries : monthEntries(ledger, month);
  return source
    .filter(
      (entry) =>
        (!filters.range ||
          (entry.date >= filters.startDate && entry.date <= filters.endDate)) &&
        (kind === 'all' || entry.kind === kind) &&
        (filters.categoryId === 'all' ||
          entry.categoryId === filters.categoryId) &&
        (filters.accountId === 'all' ||
          entry.accountId === filters.accountId ||
          entry.toAccountId === filters.accountId) &&
        (!needle ||
          `${entry.note} ${categoryFor(ledger, entry.categoryId).label} ${accounts.get(entry.accountId)} ${accounts.get(entry.toAccountId ?? '') ?? ''}`
            .toLowerCase()
            .includes(needle)),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}

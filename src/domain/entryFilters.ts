import {
  type Ledger,
  type EntryKind,
  transferCategory,
  validDate,
  refundAmounts,
  type Entry,
  parseAmount,
  amountInput,
} from './ledger';

export type EntryFilters = {
  range: boolean;
  startDate: string;
  endDate: string;
  categoryId: string;
  accountId: string;
  minAmount?: string;
  maxAmount?: string;
};
export const emptyFilters = (): EntryFilters => ({
  range: false,
  startDate: '',
  endDate: '',
  categoryId: 'all',
  accountId: 'all',
  minAmount: '',
  maxAmount: '',
});
export function validateFilters(filters: EntryFilters) {
  if (
    filters.range &&
    (!validDate(filters.startDate) || !validDate(filters.endDate))
  )
    throw new Error('请选择有效的开始和结束日期');
  if (filters.range && filters.startDate > filters.endDate)
    throw new Error('开始日期不能晚于结束日期');
  const min = amountBound(filters.minAmount);
  const max = amountBound(filters.maxAmount);
  if (min !== null && max !== null && min > max)
    throw new Error('最低金额不能大于最高金额');
  return filters;
}
export function amountBound(value?: string): number | null {
  return value?.trim() ? parseAmount(value, true) : null;
}
export function amountFilterLabel(
  filters: EntryFilters,
  hidden: boolean,
): string {
  const min = amountBound(filters.minAmount),
    max = amountBound(filters.maxAmount);
  if (min === null && max === null) return '';
  if (hidden) return '金额条件';
  const display = (amount: number) => amountInput(amount).replace(/\.00$/, '');
  if (min !== null && max !== null)
    return min === max
      ? `¥${display(min)}`
      : `¥${display(min)}–${display(max)}`;
  return min !== null ? `≥¥${display(min)}` : `≤¥${display(max!)}`;
}
function queryAmount(value: string): number | null {
  try {
    return parseAmount(value.replace(/^[¥￥]\s*/, ''), true);
  } catch {
    return null;
  }
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
export type EntryIndex = ReadonlyArray<{ entry: Entry; text: string }>;
export function buildEntryIndex(ledger: Ledger): EntryIndex {
  const accounts = new Map(
    ledger.accounts.map((account) => [account.id, account.name]),
  );
  const categories = new Map(
    [...ledger.categories, transferCategory].map((category) => [
      category.id,
      category.label,
    ]),
  );
  return ledger.entries
    .map((entry) => ({
      entry,
      text: `${entry.note} ${categories.get(entry.categoryId) ?? ''} ${accounts.get(entry.accountId) ?? ''} ${accounts.get(entry.toAccountId ?? '') ?? ''}`.toLowerCase(),
    }))
    .sort(
      (a, b) =>
        b.entry.date.localeCompare(a.entry.date) ||
        b.entry.createdAt.localeCompare(a.entry.createdAt),
    );
}
export function filterEntryIndex(
  index: EntryIndex,
  month: string,
  kind: EntryKind | 'all',
  query: string,
  filters: EntryFilters,
): Entry[] {
  validateFilters(filters);
  const needle = query.trim().toLowerCase();
  const amount = queryAmount(needle);
  const min = amountBound(filters.minAmount),
    max = amountBound(filters.maxAmount);
  return index
    .filter(
      ({ entry, text }) =>
        (filters.range
          ? entry.date >= filters.startDate && entry.date <= filters.endDate
          : entry.date.startsWith(month)) &&
        (kind === 'all' || entry.kind === kind) &&
        (filters.categoryId === 'all' ||
          entry.categoryId === filters.categoryId) &&
        (filters.accountId === 'all' ||
          entry.accountId === filters.accountId ||
          entry.toAccountId === filters.accountId) &&
        (min === null || entry.amount >= min) &&
        (max === null || entry.amount <= max) &&
        (!needle || text.includes(needle) || entry.amount === amount),
    )
    .map(({ entry }) => entry);
}
export function filteredEntries(
  ledger: Ledger,
  month: string,
  kind: EntryKind | 'all',
  query: string,
  filters: EntryFilters,
) {
  return filterEntryIndex(buildEntryIndex(ledger), month, kind, query, filters);
}

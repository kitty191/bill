import {
  dateFilterPresets,
  type EntryFilters,
  validateFilters,
} from './entryFilters';
import { type EntryKind, type Ledger } from './ledger';

export type SavedEntryFilter = {
  id: string;
  name: string;
  kind: EntryKind | 'all';
  query: string;
  filters: EntryFilters;
};

export const savedFilterLimit = 12;
export const savedFilterNameLimit = 24;

export function parseSavedEntryFilters(raw: string): SavedEntryFilter[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > savedFilterLimit)
    throw new Error('常用筛选格式无效');
  const ids = new Set<string>();
  return data.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('常用筛选格式无效');
    const { id, name, kind, query, filters } = item as SavedEntryFilter;
    if (
      typeof id !== 'string' ||
      !id ||
      ids.has(id) ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > savedFilterNameLimit ||
      !['all', 'expense', 'income', 'transfer', 'refund'].includes(kind) ||
      typeof query !== 'string' ||
      !filters ||
      typeof filters.range !== 'boolean' ||
      typeof filters.startDate !== 'string' ||
      typeof filters.endDate !== 'string' ||
      typeof filters.accountId !== 'string' ||
      typeof filters.categoryId !== 'string' ||
      (filters.minAmount !== undefined && typeof filters.minAmount !== 'string') ||
      (filters.maxAmount !== undefined && typeof filters.maxAmount !== 'string') ||
      (filters.datePreset !== undefined &&
        (!filters.range || !['recent', 'previous'].includes(filters.datePreset)))
    )
      throw new Error('常用筛选格式无效');
    ids.add(id);
    return { id, name, kind, query, filters: validateFilters(filters) };
  });
}

export function resolveSavedEntryFilter(
  saved: SavedEntryFilter,
  today: string,
  ledger: Pick<Ledger, 'accounts' | 'categories'>,
): EntryFilters {
  const { accountId, categoryId, datePreset } = saved.filters;
  if (
    accountId !== 'all' &&
    !ledger.accounts.some((account) => account.id === accountId)
  )
    throw new Error('该筛选的账户已不存在，请重新保存条件');
  if (
    categoryId !== 'all' &&
    categoryId !== 'transfer' &&
    !ledger.categories.some((category) => category.id === categoryId)
  )
    throw new Error('该筛选的分类已不存在，请重新保存条件');
  if (!datePreset) return saved.filters;
  const dates = dateFilterPresets(today)[datePreset];
  if (!dates) throw new Error('当前日期无可用的上月范围');
  return { ...saved.filters, ...dates };
}

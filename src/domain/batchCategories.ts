import { type EntryKind, type Ledger, visibleCategories } from './ledger';

export function changeEntryCategories(
  ledger: Ledger,
  ids: readonly string[],
  kind: Extract<EntryKind, 'expense' | 'income'>,
  categoryId: string,
): Ledger {
  const selected = new Set(ids);
  if (
    !selected.size ||
    !visibleCategories(ledger, kind).some((c) => c.id === categoryId)
  )
    throw new Error('请选择账单和可用分类');
  const confirmed = ledger.entries.filter((entry) => selected.has(entry.id));
  if (
    confirmed.length !== selected.size ||
    confirmed.some((entry) => entry.kind !== kind)
  )
    throw new Error('所选账单已变化，请重新选择');
  return {
    ...ledger,
    entries: ledger.entries.map((entry) =>
      selected.has(entry.id) ||
      (entry.originalEntryId && selected.has(entry.originalEntryId))
        ? { ...entry, categoryId }
        : entry,
    ),
  };
}

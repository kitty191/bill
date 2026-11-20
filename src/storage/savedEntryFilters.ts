import {
  type SavedEntryFilter,
  parseSavedEntryFilters,
} from '../domain/savedEntryFilters';
import {
  loadSavedEntryFiltersRaw,
  saveSavedEntryFiltersRaw,
} from './ledgerStore';

export async function loadSavedEntryFilters(): Promise<SavedEntryFilter[]> {
  const raw = await loadSavedEntryFiltersRaw();
  return raw === null ? [] : parseSavedEntryFilters(raw);
}

export async function saveSavedEntryFilters(
  filters: SavedEntryFilter[],
): Promise<void> {
  const raw = JSON.stringify(filters);
  parseSavedEntryFilters(raw);
  await saveSavedEntryFiltersRaw(raw);
}

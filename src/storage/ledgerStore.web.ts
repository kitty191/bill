import { type Ledger, emptyLedger, validateLedger } from '../domain/ledger';
import {
  addSnapshot,
  snapshotBeforeWrite,
  validateSnapshots,
} from '../domain/snapshots';

const key = 'qingzhang.ledger.v1';
const snapshotsKey = 'qingzhang.ledger.snapshots.v1';
const draftKey = 'qingzhang.entry-draft.v1';
const savedEntryFiltersKey = 'qingzhang.saved-entry-filters.v1';
export type SaveLedgerOptions = {
  consumeDraftId?: string;
  clearDraft?: boolean;
};

function readDraftId(raw: string | null): string | undefined {
  try {
    const id: unknown = JSON.parse(raw ?? 'null')?.id;
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

export async function loadEntryDraftRaw() {
  const raw = localStorage.getItem(draftKey);
  const draftId = readDraftId(raw);
  if (draftId) {
    const stored = localStorage.getItem(key);
    try {
      if (JSON.parse(stored ?? 'null')?.discardedDraftId === draftId) return null;
    } catch {
      // An unreadable ledger has no usable draft marker.
    }
  }
  return raw;
}
export async function saveEntryDraftRaw(payload: string) {
  localStorage.setItem(draftKey, payload);
}
export async function loadSavedEntryFiltersRaw() {
  return localStorage.getItem(savedEntryFiltersKey);
}
export async function saveSavedEntryFiltersRaw(payload: string) {
  localStorage.setItem(savedEntryFiltersKey, payload);
}
export async function clearEntryDraftRaw(id?: string) {
  const raw = localStorage.getItem(draftKey);
  if (id && raw && readDraftId(raw) !== id) return;
  localStorage.removeItem(draftKey);
}
export async function loadSnapshots() {
  return validateSnapshots(
    JSON.parse(localStorage.getItem(snapshotsKey) ?? '[]'),
  );
}
export async function clearSnapshots() {
  localStorage.removeItem(snapshotsKey);
}
export async function loadLedger(): Promise<Ledger> {
  const data = localStorage.getItem(key);
  return data === null ? emptyLedger() : validateLedger(JSON.parse(data));
}
export async function saveLedger(
  ledger: Ledger,
  options?: SaveLedgerOptions,
): Promise<Ledger> {
  const valid = validateLedger(ledger);
  const current = localStorage.getItem(key);
  let discardedDraftId: string | undefined;
  let legacy = false;
  let older = false;
  let before4 = false;
  try {
    const stored = current ? JSON.parse(current) : null;
    const version = stored?.version;
    legacy = version === 1;
    older = [1, 2].includes(version);
    before4 = [1, 2, 3].includes(version);
    if (typeof stored?.discardedDraftId === 'string')
      discardedDraftId = stored.discardedDraftId;
  } catch {
    /* Recovery is explicitly confirmed. */
  }
  if (older && localStorage.getItem('qingzhang.ledger.before-v3') === null)
    localStorage.setItem('qingzhang.ledger.before-v3', current!);
  if (legacy && localStorage.getItem('qingzhang.ledger.legacy-v1') === null)
    localStorage.setItem('qingzhang.ledger.legacy-v1', current!);
  if (before4 && localStorage.getItem('qingzhang.ledger.before-v4') === null)
    localStorage.setItem('qingzhang.ledger.before-v4', current!);
  const previous = snapshotBeforeWrite(current, valid);
  if (previous !== null) {
    try {
      localStorage.setItem(
        snapshotsKey,
        JSON.stringify(addSnapshot(await loadSnapshots(), previous)),
      );
    } catch (error) {
      throw new Error(
        `自动快照保存失败，账本未更新：${error instanceof Error ? error.message : '请在设置中检查本机快照'}`,
      );
    }
  }
  if (options?.clearDraft)
    discardedDraftId = readDraftId(localStorage.getItem(draftKey));
  else if (
    discardedDraftId &&
    readDraftId(localStorage.getItem(draftKey)) !== discardedDraftId
  )
    discardedDraftId = undefined;
  // Commit the marker with the replacement so a failed cleanup cannot make
  // the discarded draft available again. The marker stays out of backups.
  const payload = JSON.stringify(
    discardedDraftId ? { ...valid, discardedDraftId } : valid,
  );
  localStorage.setItem(key, payload);
  if (options?.clearDraft || options?.consumeDraftId) {
    try {
      await clearEntryDraftRaw(
        options.clearDraft ? undefined : options.consumeDraftId,
      );
    } catch {
      // A replacement marker or the saved entry's identity prevents reopening
      // an obsolete draft if physical removal fails after the commit.
    }
  }
  return valid;
}
export async function loadLegacyLedger(): Promise<string | null> {
  const before4 = localStorage.getItem('qingzhang.ledger.before-v4');
  if (before4) return before4;
  const raw = localStorage.getItem(key);
  if (raw && [1, 2, 3].includes(JSON.parse(raw).version)) return raw;
  const backup = localStorage.getItem('qingzhang.ledger.before-v3');
  if (backup) return backup;
  const current = localStorage.getItem(key);
  if (current && [1, 2].includes(JSON.parse(current).version)) return current;
  return localStorage.getItem('qingzhang.ledger.legacy-v1');
}

import { type Ledger, emptyLedger, validateLedger } from '../domain/ledger';
import {
  addSnapshot,
  snapshotBeforeWrite,
  validateSnapshots,
} from '../domain/snapshots';

const key = 'qingzhang.ledger.v1';
const snapshotsKey = 'qingzhang.ledger.snapshots.v1';
const draftKey = 'qingzhang.entry-draft.v1';
export type SaveLedgerOptions = {
  consumeDraftId?: string;
  clearDraft?: boolean;
};
export async function loadEntryDraftRaw() {
  return localStorage.getItem(draftKey);
}
export async function saveEntryDraftRaw(payload: string) {
  localStorage.setItem(draftKey, payload);
}
export async function clearEntryDraftRaw(id?: string) {
  const raw = localStorage.getItem(draftKey);
  if (id && raw) {
    try {
      if (JSON.parse(raw)?.id !== id) return;
    } catch {
      return;
    }
  }
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
  const payload = JSON.stringify(valid);
  const current = localStorage.getItem(key);
  let legacy = false;
  let older = false;
  let before4 = false;
  try {
    const version = current ? JSON.parse(current).version : undefined;
    legacy = version === 1;
    older = [1, 2].includes(version);
    before4 = [1, 2, 3].includes(version);
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
  if (options?.clearDraft) await clearEntryDraftRaw();
  localStorage.setItem(key, payload);
  // localStorage has no multi-key transactions. The stable record ID and edit
  // fingerprint reject already-saved drafts if cleanup fails after this write.
  if (options?.consumeDraftId) {
    try {
      await clearEntryDraftRaw(options.consumeDraftId);
    } catch {
      /* Entry is already committed. */
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

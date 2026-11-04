import { emptyLedger, id, type Ledger, validateLedger } from './ledger';

export type LocalSnapshot = { id: string; createdAt: string; payload: string };
export const SNAPSHOT_LIMIT = 5;
export function validateSnapshots(input: unknown): LocalSnapshot[] {
  if (!Array.isArray(input) || input.length > SNAPSHOT_LIMIT)
    throw new Error('本机快照索引无效，可导出账本后清理快照');
  const ids = new Set<string>();
  return input.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      typeof item.payload !== 'string'
    )
      throw new Error('本机快照格式无效');
    ids.add(item.id);
    return { id: item.id, createdAt: item.createdAt, payload: item.payload };
  });
}
export function snapshotBeforeWrite(
  previous: string | null,
  next: Ledger,
): string | null {
  let old: Ledger;
  try {
    old =
      previous === null ? emptyLedger() : validateLedger(JSON.parse(previous));
  } catch {
    return null;
  } // Explicit recovery can replace an unreadable main record.
  if (
    JSON.stringify({
      ...old,
      showAccountCards: false,
      recurringEnabled: false,
    }) ===
    JSON.stringify({
      ...next,
      showAccountCards: false,
      recurringEnabled: false,
    })
  )
    return null;
  return previous ?? JSON.stringify(old);
}
export function addSnapshot(
  history: LocalSnapshot[],
  payload: string,
): LocalSnapshot[] {
  validateLedger(JSON.parse(payload));
  if (history[0]?.payload === payload) return history;
  return [
    { id: `snapshot-${id()}`, createdAt: new Date().toISOString(), payload },
    ...history,
  ].slice(0, SNAPSHOT_LIMIT);
}

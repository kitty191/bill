import { type Ledger, emptyLedger, validateLedger } from '../domain/ledger';

const key = 'qingzhang.ledger.v1';
export async function loadLedger(): Promise<Ledger> {
  const data = localStorage.getItem(key);
  return data === null ? emptyLedger() : validateLedger(JSON.parse(data));
}
export async function saveLedger(ledger: Ledger): Promise<void> {
  const payload = JSON.stringify(validateLedger(ledger));
  const current = localStorage.getItem(key);
  let legacy = false;
  try {
    legacy = current !== null && JSON.parse(current).version === 1;
  } catch {
    /* Recovery is explicitly confirmed. */
  }
  if (legacy && localStorage.getItem('qingzhang.ledger.legacy-v1') === null)
    localStorage.setItem('qingzhang.ledger.legacy-v1', current!);
  localStorage.setItem(key, payload);
}
export async function loadLegacyLedger(): Promise<string | null> {
  const backup = localStorage.getItem('qingzhang.ledger.legacy-v1');
  if (backup) return backup;
  const current = localStorage.getItem(key);
  return current && JSON.parse(current).version === 1 ? current : null;
}

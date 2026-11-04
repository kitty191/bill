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
  let older = false;
  try {
    legacy = current !== null && JSON.parse(current).version === 1;
    older = current !== null && [1, 2].includes(JSON.parse(current).version);
  } catch {
    /* Recovery is explicitly confirmed. */
  }
  if (older && localStorage.getItem('qingzhang.ledger.before-v3') === null)
    localStorage.setItem('qingzhang.ledger.before-v3', current!);
  if (legacy && localStorage.getItem('qingzhang.ledger.legacy-v1') === null)
    localStorage.setItem('qingzhang.ledger.legacy-v1', current!);
  localStorage.setItem(key, payload);
}
export async function loadLegacyLedger(): Promise<string | null> {
  const backup = localStorage.getItem('qingzhang.ledger.before-v3');
  if (backup) return backup;
  const current = localStorage.getItem(key);
  if (current && [1, 2].includes(JSON.parse(current).version)) return current;
  return localStorage.getItem('qingzhang.ledger.legacy-v1');
}

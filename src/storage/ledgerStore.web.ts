import { type Ledger, emptyLedger, validateLedger } from '../domain/ledger';

const key = 'qingzhang.ledger.v1';
export async function loadLedger(): Promise<Ledger> {
  const data = localStorage.getItem(key);
  return data === null ? emptyLedger() : validateLedger(JSON.parse(data));
}
export async function saveLedger(ledger: Ledger): Promise<void> {
  localStorage.setItem(key, JSON.stringify(validateLedger(ledger)));
}

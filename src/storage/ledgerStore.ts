import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { type Ledger, emptyLedger, validateLedger } from '../domain/ledger';

let database: Promise<SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const connection = await openDatabaseAsync('qingzhang.db');
      await connection.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);',
      );
      return connection;
    })().catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}

export async function loadLedger(): Promise<Ledger> {
  const row = await (
    await db()
  ).getFirstAsync<{ payload: string }>(
    'SELECT payload FROM ledger WHERE id = 1',
  );
  return row ? validateLedger(JSON.parse(row.payload)) : emptyLedger();
}

export async function saveLedger(ledger: Ledger): Promise<void> {
  const payload = JSON.stringify(validateLedger(ledger));
  await (
    await db()
  ).runAsync(
    'INSERT INTO ledger (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
    payload,
  );
}

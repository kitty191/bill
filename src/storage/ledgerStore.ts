import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { type Ledger, emptyLedger, validateLedger } from '../domain/ledger';
import {
  addSnapshot,
  snapshotBeforeWrite,
  validateSnapshots,
} from '../domain/snapshots';

let database: Promise<SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const connection = await openDatabaseAsync('qingzhang.db');
      await connection.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS upgrade_backup (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS legacy_backup (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS upgrade_backup_v4 (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS local_snapshots (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);',
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
  const valid = validateLedger(ledger);
  const payload = JSON.stringify(valid);
  await (
    await db()
  ).withExclusiveTransactionAsync(async (transaction) => {
    const old = await transaction.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM ledger WHERE id = 1',
    );
    let legacy = false;
    let older = false;
    let before4 = false;
    try {
      legacy = old !== null && JSON.parse(old.payload).version === 1;
      older = old !== null && [1, 2].includes(JSON.parse(old.payload).version);
      before4 =
        old !== null && [1, 2, 3].includes(JSON.parse(old.payload).version);
    } catch {
      /* Explicit recovery may replace unreadable data. */
    }
    if (older)
      await transaction.runAsync(
        'INSERT OR IGNORE INTO upgrade_backup (id, payload) VALUES (1, ?)',
        old!.payload,
      );
    if (legacy)
      await transaction.runAsync(
        'INSERT OR IGNORE INTO legacy_backup (id, payload) VALUES (1, ?)',
        old!.payload,
      );
    if (before4)
      await transaction.runAsync(
        'INSERT OR IGNORE INTO upgrade_backup_v4 (id, payload) VALUES (1, ?)',
        old!.payload,
      );
    const previous = snapshotBeforeWrite(old?.payload ?? null, valid);
    if (previous !== null) {
      try {
        const history = await transaction.getFirstAsync<{ payload: string }>(
          'SELECT payload FROM local_snapshots WHERE id = 1',
        );
        const next = addSnapshot(
          validateSnapshots(JSON.parse(history?.payload ?? '[]')),
          previous,
        );
        await transaction.runAsync(
          'INSERT INTO local_snapshots (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          JSON.stringify(next),
        );
      } catch (error) {
        throw new Error(
          `自动快照保存失败，账本未更新：${error instanceof Error ? error.message : '请检查本机快照'}`,
        );
      }
    }
    await transaction.runAsync(
      'INSERT INTO ledger (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      payload,
    );
  });
}
export async function loadLegacyLedger(): Promise<string | null> {
  const connection = await db();
  const before4 = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM upgrade_backup_v4 WHERE id = 1',
  );
  if (before4) return before4.payload;
  const raw = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM ledger WHERE id = 1',
  );
  if (raw && [1, 2, 3].includes(JSON.parse(raw.payload).version))
    return raw.payload;
  const previous = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM upgrade_backup WHERE id = 1',
  );
  if (previous) return previous.payload;
  const current = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM ledger WHERE id = 1',
  );
  if (current && [1, 2].includes(JSON.parse(current.payload).version))
    return current.payload;
  const backup = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM legacy_backup WHERE id = 1',
  );
  return backup?.payload ?? null;
}
export async function loadSnapshots() {
  const row = await (
    await db()
  ).getFirstAsync<{ payload: string }>(
    'SELECT payload FROM local_snapshots WHERE id = 1',
  );
  return validateSnapshots(JSON.parse(row?.payload ?? '[]'));
}
export async function clearSnapshots() {
  await (await db()).runAsync('DELETE FROM local_snapshots WHERE id = 1');
}

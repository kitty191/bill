import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { type Ledger, emptyLedger, id, validateLedger } from '../domain/ledger';
import {
  type LocalSnapshot,
  snapshotBeforeWrite,
  validateSnapshots,
} from '../domain/snapshots';

let database: Promise<SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const connection = await openDatabaseAsync('qingzhang.db');
      await connection.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS upgrade_backup (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS legacy_backup (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS upgrade_backup_v4 (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS local_snapshots (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshot_versions (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL, payload TEXT NOT NULL);',
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
      const version = old ? JSON.parse(old.payload).version : undefined;
      legacy = version === 1;
      older = [1, 2].includes(version);
      before4 = [1, 2, 3].includes(version);
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
        if (history) {
          const snapshots = validateSnapshots(JSON.parse(history.payload));
          await transaction.runAsync('DELETE FROM snapshot_versions');
          for (const snapshot of [...snapshots].reverse())
            await transaction.runAsync(
              'INSERT INTO snapshot_versions (id, createdAt, payload) VALUES (?, ?, ?)',
              snapshot.id,
              snapshot.createdAt,
              snapshot.payload,
            );
          await transaction.runAsync(
            'DELETE FROM local_snapshots WHERE id = 1',
          );
        }
        const latest = await transaction.getFirstAsync<{ payload: string }>(
          'SELECT payload FROM snapshot_versions ORDER BY seq DESC LIMIT 1',
        );
        if (latest?.payload !== previous)
          await transaction.runAsync(
            'INSERT INTO snapshot_versions (id, createdAt, payload) VALUES (?, ?, ?)',
            `snapshot-${id()}`,
            new Date().toISOString(),
            previous,
          );
        await transaction.runAsync(
          'DELETE FROM snapshot_versions WHERE seq NOT IN (SELECT seq FROM snapshot_versions ORDER BY seq DESC LIMIT 5)',
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
  const connection = await db();
  const row = await connection.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM local_snapshots WHERE id = 1',
  );
  if (row) return validateSnapshots(JSON.parse(row.payload));
  return validateSnapshots(
    await connection.getAllAsync<LocalSnapshot>(
      'SELECT id, createdAt, payload FROM snapshot_versions ORDER BY seq DESC LIMIT 5',
    ),
  );
}
export async function clearSnapshots() {
  await (
    await db()
  ).withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM local_snapshots WHERE id = 1');
    await transaction.runAsync('DELETE FROM snapshot_versions');
  });
}

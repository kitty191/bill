import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { id } from '../domain/ledger';

let connection: Promise<SQLiteDatabase> | undefined;
const lifetime = 30 * 60 * 1000;
async function database() {
  if (!connection)
    connection = (async () => {
      const value = await openDatabaseAsync('qingzhang-backup-jobs.db');
      await value.execAsync(
        'CREATE TABLE IF NOT EXISTS backup_job (id INTEGER PRIMARY KEY CHECK(id = 1), owner TEXT NOT NULL, expires INTEGER NOT NULL)',
      );
      return value;
    })().catch((error) => {
      connection = undefined;
      throw error;
    });
  return connection;
}

// A separate tiny database coordinates foreground and headless runtimes. No
// financial transaction stays open while a document provider performs I/O.
export async function withBackupLock<T>(
  operation: (renew: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const db = await database(),
    owner = id(),
    now = Date.now();
  const acquired = await db.runAsync(
    'INSERT INTO backup_job (id, owner, expires) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, expires = excluded.expires WHERE backup_job.expires <= ?',
    owner,
    now + lifetime,
    now,
  );
  if (acquired.changes !== 1) throw new Error('自动备份正在进行，请稍后再试');
  const renew = async () => {
    const now = Date.now();
    const result = await db.runAsync(
      'UPDATE backup_job SET expires = ? WHERE id = 1 AND owner = ? AND expires > ?',
      now + lifetime,
      owner,
      now,
    );
    if (result.changes !== 1) throw new Error('备份操作已过期，请重新尝试');
  };
  try {
    return await operation(renew);
  } finally {
    await db.runAsync(
      'DELETE FROM backup_job WHERE id = 1 AND owner = ?',
      owner,
    );
  }
}

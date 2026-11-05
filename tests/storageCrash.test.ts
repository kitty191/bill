import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { emptyLedger } from '../src/domain/ledger';

it('an actual process kill during a WAL transaction retains the prior ledger and draft and rolls back its snapshot', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'qingzhang-crash-'));
  const file = path.join(directory, 'ledger.db');
  const initial = JSON.stringify(emptyLedger());
  const connection = new DatabaseSync(file);
  connection.exec(
    'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE ledger(id INTEGER PRIMARY KEY,payload TEXT); CREATE TABLE entry_draft(id INTEGER PRIMARY KEY,payload TEXT); CREATE TABLE snapshots(payload TEXT);',
  );
  connection.prepare('INSERT INTO ledger VALUES(1,?)').run(initial);
  connection
    .prepare('INSERT INTO entry_draft VALUES(1,?)')
    .run('{"expression":"12+3"}');
  connection.close();
  const source = `import sqlite3, sys, time
db = sqlite3.connect(sys.argv[1])
db.execute('BEGIN IMMEDIATE')
db.execute('INSERT INTO snapshots VALUES(?)', ('old',))
db.execute('UPDATE ledger SET payload=? WHERE id=1', ('uncommitted',))
db.execute('DELETE FROM entry_draft')
print('transaction-open', flush=True)
time.sleep(60)
`;
  const child = spawn('python3', ['-c', source, file], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      let text = '';
      const timer = setTimeout(
        () =>
          reject(new Error('Crash fixture did not reach its open transaction')),
        5000,
      );
      child.stdout.on('data', (chunk) => {
        text += String(chunk);
        if (text.includes('transaction-open')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timer);
          reject(new Error('Crash fixture exited early'));
        }
      });
    });
    const exited = new Promise<void>((resolve) =>
      child.once('exit', () => resolve()),
    );
    child.kill('SIGKILL');
    await exited;
    const recovered = new DatabaseSync(file);
    expect(recovered.prepare('SELECT payload FROM ledger').get()).toEqual({
      payload: initial,
    });
    expect(recovered.prepare('SELECT payload FROM entry_draft').get()).toEqual({
      payload: '{"expression":"12+3"}',
    });
    expect(recovered.prepare('SELECT * FROM snapshots').all()).toEqual([]);
    recovered.close();
  } finally {
    child.kill('SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  }
});

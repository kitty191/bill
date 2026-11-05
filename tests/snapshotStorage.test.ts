import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLedger, type Ledger } from '../src/domain/ledger';
import {
  addSnapshot,
  snapshotBeforeWrite,
  validateSnapshots,
} from '../src/domain/snapshots';

const faults = vi.hoisted(() => ({
  failSnapshot: false,
  failLedger: false,
  failDraft: false,
  writes: [] as { sql: string; bytes: number }[],
}));
let database: DatabaseSync;
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    database = new DatabaseSync(':memory:');
    const connection = {
      execAsync: async (sql: string) => {
        database.exec(sql);
      },
      getFirstAsync: async (sql: string, ...args: SQLInputValue[]) =>
        database.prepare(sql).get(...args) ?? null,
      getAllAsync: async (sql: string, ...args: SQLInputValue[]) =>
        database.prepare(sql).all(...args),
      runAsync: async (sql: string, ...args: SQLInputValue[]) => {
        faults.writes.push({
          sql,
          bytes: args.reduce<number>(
            (sum, arg) =>
              sum + (typeof arg === 'string' ? Buffer.byteLength(arg) : 0),
            0,
          ),
        });
        if (
          faults.failSnapshot &&
          (sql.startsWith('INSERT INTO local_snapshots') ||
            sql.startsWith('INSERT INTO snapshot_versions'))
        )
          throw new Error('快照空间不足');
        if (faults.failLedger && sql.startsWith('INSERT INTO ledger'))
          throw new Error('账本写入失败');
        if (faults.failDraft && sql.startsWith('DELETE FROM entry_draft'))
          throw new Error('草稿消费失败');
        database.prepare(sql).run(...args);
      },
      withExclusiveTransactionAsync: async (
        operation: (transaction: unknown) => Promise<void>,
      ) => {
        database.exec('BEGIN IMMEDIATE');
        try {
          await operation(connection);
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      },
    };
    return connection;
  },
}));
import * as native from '../src/storage/ledgerStore';
import * as web from '../src/storage/ledgerStore.web';
const data = new Map<string, string>();
const key = 'qingzhang.ledger.v1',
  historyKey = 'qingzhang.ledger.snapshots.v1';
let failWebKey = '';
beforeEach(async () => {
  faults.failLedger = false;
  faults.failDraft = false;
  faults.failSnapshot = false;
  failWebKey = '';
  data.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failWebKey) throw new Error('存储空间不足');
      data.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
  });
  await native.loadLedger();
  database.exec(
    'DELETE FROM ledger; DELETE FROM entry_draft; DELETE FROM local_snapshots; DELETE FROM snapshot_versions; DELETE FROM upgrade_backup; DELETE FROM upgrade_backup_v4; DELETE FROM legacy_backup;',
  );
});
afterAll(() => {
  database.close();
  vi.unstubAllGlobals();
});
const changed = (amount: number): Ledger => ({
  ...emptyLedger(),
  monthlyBudget: amount,
});
it('measures actual SQLite writes for a 10000-record book with five snapshots', async () => {
  const ledger: Ledger = {
    ...emptyLedger(),
    entries: Array.from({ length: 10000 }, (_, index) => ({
      id: `large-${index}`,
      kind: 'expense',
      amount: 100,
      categoryId: 'food',
      accountId: 'wechat',
      date: '2026-11-01',
      note: `性能-${index}`,
      createdAt: '2026-11-01T04:00:00Z',
    })),
  };
  for (let index = 0; index < 6; index++)
    await native.saveLedger({ ...ledger, monthlyBudget: index * 100 });
  faults.writes = [];
  const start = performance.now();
  await native.saveLedger({ ...ledger, monthlyBudget: 700 });
  const report = {
    records: ledger.entries.length,
    retainedSnapshots: (await native.loadSnapshots()).length,
    saveAndReadHistoryMs: performance.now() - start,
    writeParameterBytes: faults.writes.reduce(
      (sum, item) => sum + item.bytes,
      0,
    ),
    writes: faults.writes,
    platform:
      'Node SQLite in memory through the app storage adapter; not Expo native bridge timing',
  };
  expect((await native.loadLedger()).entries).toHaveLength(10000);
  expect(report.retainedSnapshots).toBe(5);
  expect(report.writeParameterBytes).toBeLessThan(
    Buffer.byteLength(JSON.stringify(ledger)) * 2 + 1000,
  );
  if (process.env.QINGZHANG_STORAGE_BENCHMARK)
    writeFileSync(
      process.env.QINGZHANG_STORAGE_BENCHMARK,
      JSON.stringify(report, null, 2) + '\n',
    );
});
describe('legacy snapshot row migration', () => {
  const history = [300, 200, 100].map((amount) => ({
    id: `old-${amount}`,
    createdAt: '2026-11-04T04:00:00Z',
    payload: JSON.stringify(changed(amount)),
  }));
  async function seedLegacy() {
    database
      .prepare('INSERT INTO ledger (id, payload) VALUES (1, ?)')
      .run(JSON.stringify(changed(400)));
    database
      .prepare('INSERT INTO local_snapshots (id, payload) VALUES (1, ?)')
      .run(JSON.stringify(history));
  }
  it('preserves exact old IDs and ordering even when timestamps are equal', async () => {
    await seedLegacy();
    expect(await native.loadSnapshots()).toEqual(history);
    await native.saveLedger(changed(500));
    const migrated = await native.loadSnapshots();
    expect(migrated.slice(1)).toEqual(history);
    expect(JSON.parse(migrated[0]!.payload).monthlyBudget).toBe(400);
    expect(
      database.prepare('SELECT payload FROM local_snapshots').get(),
    ).toBeUndefined();
  });
  it('rolls the migration back with the main record on failure and retries without dropping versions', async () => {
    await seedLegacy();
    faults.failLedger = true;
    await expect(native.saveLedger(changed(500))).rejects.toThrow(
      '账本写入失败',
    );
    expect(await native.loadSnapshots()).toEqual(history);
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM snapshot_versions').get(),
    ).toEqual({ count: 0 });
    expect((await native.loadLedger()).monthlyBudget).toBe(400);
    faults.failLedger = false;
    await native.saveLedger(changed(500));
    expect((await native.loadSnapshots()).slice(1)).toEqual(history);
  });
  it('lets a valid main ledger load and history be cleared when the old index is corrupt', async () => {
    await seedLegacy();
    database.prepare('UPDATE local_snapshots SET payload = ?').run('{broken');
    expect((await native.loadLedger()).monthlyBudget).toBe(400);
    await expect(native.saveLedger(changed(500))).rejects.toThrow(
      '自动快照保存失败',
    );
    expect((await native.loadLedger()).monthlyBudget).toBe(400);
    await native.clearSnapshots();
    expect(await native.loadSnapshots()).toEqual([]);
    await native.saveLedger(changed(500));
    expect((await native.loadLedger()).monthlyBudget).toBe(500);
  });
});

describe.each([
  ['SQLite', native],
  ['web', web],
] as const)('%s automatic snapshots', (_name, storage) => {
  it('keeps five exact previous versions and ignores display-only writes', async () => {
    for (let index = 1; index <= 7; index++)
      await storage.saveLedger(changed(index * 100));
    const history = await storage.loadSnapshots();
    expect(history).toHaveLength(5);
    expect(
      history.map((item) => JSON.parse(item.payload).monthlyBudget),
    ).toEqual([600, 500, 400, 300, 200]);
    await storage.saveLedger({
      ...changed(700),
      showAccountCards: true,
      recurringEnabled: true,
    });
    expect(await storage.loadSnapshots()).toEqual(history);
    expect((await storage.loadLedger()).monthlyBudget).toBe(700);
  });
  it('retains the replaced current version when recovering an older snapshot', async () => {
    await storage.saveLedger(changed(100));
    await storage.saveLedger(changed(200));
    const previous = (await storage.loadSnapshots())[0]!;
    await storage.saveLedger(JSON.parse(previous.payload));
    expect((await storage.loadLedger()).monthlyBudget).toBe(100);
    expect(
      JSON.parse((await storage.loadSnapshots())[0]!.payload).monthlyBudget,
    ).toBe(200);
    await storage.clearSnapshots();
    expect(await storage.loadSnapshots()).toEqual([]);
    expect((await storage.loadLedger()).monthlyBudget).toBe(100);
  });
  it('keeps the old main ledger unchanged if automatic snapshot storage fails', async () => {
    await storage.saveLedger(changed(100));
    if (_name === 'SQLite') faults.failSnapshot = true;
    else failWebKey = historyKey;
    await expect(storage.saveLedger(changed(200))).rejects.toThrow(
      '自动快照保存失败',
    );
    expect((await storage.loadLedger()).monthlyBudget).toBe(100);
  });
  it('rejects invalid next ledgers before changing either primary data or history', async () => {
    await storage.saveLedger(changed(100));
    const history = await storage.loadSnapshots();
    await expect(storage.saveLedger(changed(-1))).rejects.toThrow('预算');
    expect(await storage.loadSnapshots()).toEqual(history);
    expect((await storage.loadLedger()).monthlyBudget).toBe(100);
  });
});
it('commits the native snapshot and main data atomically, rolling both back on final write failure', async () => {
  await native.saveLedger(changed(100));
  const history = await native.loadSnapshots();
  faults.failLedger = true;
  await expect(native.saveLedger(changed(200))).rejects.toThrow('账本写入失败');
  expect(await native.loadSnapshots()).toEqual(history);
  expect((await native.loadLedger()).monthlyBudget).toBe(100);
});
it('keeps a harmless previous-version snapshot on web primary-write failure, without claiming success', async () => {
  await web.saveLedger(changed(100));
  failWebKey = key;
  await expect(web.saveLedger(changed(200))).rejects.toThrow('存储空间不足');
  expect((await web.loadLedger()).monthlyBudget).toBe(100);
  expect(
    JSON.parse((await web.loadSnapshots())[0]!.payload).monthlyBudget,
  ).toBe(100);
});
it('preserves a complete v3 raw migration backup and rejects its snapshot-write failure', async () => {
  const old = {
    ...changed(100),
    version: 3,
    monthBudgets: { '2026-11': 12345 },
  };
  data.set(key, JSON.stringify(old));
  failWebKey = historyKey;
  await expect(web.saveLedger(changed(200))).rejects.toThrow(
    '自动快照保存失败',
  );
  expect(JSON.parse(data.get(key)!)).toEqual(old);
  failWebKey = '';
  await web.saveLedger(changed(200));
  expect(JSON.parse((await web.loadLegacyLedger())!)).toEqual(old);
  expect(JSON.parse((await web.loadSnapshots())[0]!.payload)).toEqual(old);
});
it('rolls the native v3 upgrade backup back with a failed snapshot, then preserves the exact source on retry', async () => {
  const old = {
    ...changed(100),
    version: 3,
    monthBudgets: { '2026-11': 12345 },
  };
  database
    .prepare('INSERT INTO ledger (id, payload) VALUES (1, ?)')
    .run(JSON.stringify(old));
  faults.failSnapshot = true;
  await expect(native.saveLedger(changed(200))).rejects.toThrow(
    '自动快照保存失败',
  );
  expect(
    database
      .prepare('SELECT payload FROM upgrade_backup_v4 WHERE id = 1')
      .get(),
  ).toBeUndefined();
  expect(
    JSON.parse(
      (
        database.prepare('SELECT payload FROM ledger WHERE id = 1').get() as {
          payload: string;
        }
      ).payload,
    ),
  ).toEqual(old);
  faults.failSnapshot = false;
  await native.saveLedger(changed(200));
  expect(JSON.parse((await native.loadLegacyLedger())!)).toEqual(old);
  expect(JSON.parse((await native.loadSnapshots())[0]!.payload)).toEqual(old);
});
it('does not capture corrupt main data during explicit recovery and validates snapshot metadata', () => {
  expect(snapshotBeforeWrite('{broken', changed(1))).toBeNull();
  expect(snapshotBeforeWrite(null, emptyLedger())).toBeNull();
  expect(() =>
    validateSnapshots([{ id: 'a', createdAt: 'invalid', payload: '{}' }]),
  ).toThrow();
  const history = addSnapshot([], JSON.stringify(changed(1)));
  expect(addSnapshot(history, history[0]!.payload)).toBe(history);
  expect(() => addSnapshot(history, '{}')).toThrow();
  expect(() => validateSnapshots([...history, ...history])).toThrow();
});

it('atomically consumes only the saved native draft and retains it if the ledger write fails', async () => {
  await native.clearEntryDraftRaw();
  await native.saveEntryDraftRaw(JSON.stringify({ id: 'draft-a' }));
  faults.failLedger = true;
  await expect(
    native.saveLedger(changed(99), { consumeDraftId: 'draft-a' }),
  ).rejects.toThrow('账本写入失败');
  expect(await native.loadEntryDraftRaw()).toBe('{"id":"draft-a"}');
  faults.failLedger = false;
  await native.saveLedger(changed(99), { consumeDraftId: 'draft-b' });
  expect(await native.loadEntryDraftRaw()).toBe('{"id":"draft-a"}');
  await native.saveLedger(changed(100), { consumeDraftId: 'draft-a' });
  expect(await native.loadEntryDraftRaw()).toBeNull();
  await native.saveEntryDraftRaw('{"id":"draft-c"}');
  await native.saveLedger(changed(101), { clearDraft: true });
  expect(await native.loadEntryDraftRaw()).toBeNull();
});
it('conditionally clears web drafts without discarding newer work and clears drafts on data replacement', async () => {
  await web.saveEntryDraftRaw('{"id":"draft-a"}');
  await web.clearEntryDraftRaw('draft-b');
  expect(await web.loadEntryDraftRaw()).toBe('{"id":"draft-a"}');
  await web.saveLedger(changed(1), { consumeDraftId: 'draft-a' });
  expect(await web.loadEntryDraftRaw()).toBeNull();
  await web.saveEntryDraftRaw('{"id":"draft-a"}');
  await web.saveLedger(changed(2), { clearDraft: true });
  expect(await web.loadEntryDraftRaw()).toBeNull();
});

it('failure consuming a draft after the ledger write rolls back the complete native transaction', async () => {
  await native.saveLedger(changed(100));
  await native.saveEntryDraftRaw('{"id":"pending-draft"}');
  const history = await native.loadSnapshots();
  faults.failDraft = true;
  await expect(
    native.saveLedger(changed(200), { consumeDraftId: 'pending-draft' }),
  ).rejects.toThrow('草稿消费失败');
  expect(await native.loadLedger()).toEqual(changed(100));
  expect(await native.loadEntryDraftRaw()).toBe('{"id":"pending-draft"}');
  expect(await native.loadSnapshots()).toEqual(history);
  faults.failDraft = false;
  const committed = await native.saveLedger(changed(200), {
    consumeDraftId: 'pending-draft',
  });
  expect(committed).toEqual(await native.loadLedger());
  expect(await native.loadEntryDraftRaw()).toBeNull();
});
it('returns the validated canonical value and rejects invalid money before changing native storage', async () => {
  const input = changed(100);
  input.accounts[0]!.name = '  现金账户  ';
  const committed = await native.saveLedger(input);
  expect(committed.accounts[0]!.name).toBe('现金账户');
  expect(await native.loadLedger()).toEqual(committed);
  await expect(
    native.saveLedger({ ...input, monthlyBudget: 0.1 }),
  ).rejects.toThrow();
  expect(await native.loadLedger()).toEqual(committed);
});

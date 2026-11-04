import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLedger, type Ledger } from '../src/domain/ledger';
import {
  addSnapshot,
  snapshotBeforeWrite,
  validateSnapshots,
} from '../src/domain/snapshots';

const faults = vi.hoisted(() => ({ failSnapshot: false, failLedger: false }));
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
      runAsync: async (sql: string, ...args: SQLInputValue[]) => {
        if (
          faults.failSnapshot &&
          sql.startsWith('INSERT INTO local_snapshots')
        )
          throw new Error('快照空间不足');
        if (faults.failLedger && sql.startsWith('INSERT INTO ledger'))
          throw new Error('账本写入失败');
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
    'DELETE FROM ledger; DELETE FROM local_snapshots; DELETE FROM upgrade_backup; DELETE FROM upgrade_backup_v4; DELETE FROM legacy_backup;',
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

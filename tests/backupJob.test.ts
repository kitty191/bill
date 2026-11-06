import { beforeEach, expect, it, vi } from 'vitest';
import { defaultBackupPreferences } from '../src/domain/automaticBackup';
import { emptyLedger } from '../src/domain/ledger';
const f = vi.hoisted(() => ({
  prefs: null as any,
  book: null as any,
  files: new Map<string, string>(),
  fail: false,
  lost: false,
  busy: false,
}));
vi.mock('../src/storage/automaticBackup', () => ({
  loadBackupPreferences: vi.fn(async () => ({ ...f.prefs })),
  saveBackupPreferences: vi.fn(async (value) => {
    f.prefs = { ...value };
  }),
  backupFiles: {
    write: vi.fn(async (_dir, name, payload) => {
      if (f.fail) throw new Error('磁盘已满');
      f.files.set(name, payload);
      return { name, uri: name };
    }),
    read: vi.fn(async ({ uri }) => f.files.get(uri)),
    list: vi.fn(async () =>
      [...f.files.keys()].map((name) => ({ name, uri: name })),
    ),
    remove: vi.fn(async ({ uri }) => {
      f.files.delete(uri);
    }),
  },
}));
vi.mock('../src/storage/ledgerStore', () => ({
  loadLedger: vi.fn(async () => f.book),
}));
vi.mock('../src/storage/backupLock', () => ({
  withBackupLock: async (operation: any) => {
    if (f.busy) throw new Error('正在备份');
    f.busy = true;
    try {
      return await operation(async () => {
        if (f.lost) throw new Error('操作已过期');
      });
    } finally {
      f.busy = false;
    }
  },
}));
import {
  executeBackup,
  changeBackupPreferences,
} from '../src/storage/backupJob';
import { loadLedger } from '../src/storage/ledgerStore';
import { backupFiles } from '../src/storage/automaticBackup';
beforeEach(() => {
  vi.clearAllMocks();
  f.fail = f.lost = f.busy = false;
  f.files.clear();
  f.prefs = { ...defaultBackupPreferences(), directory: 'folder', days: 1 };
  f.book = emptyLedger();
});
it('uses the latest committed ledger and a read-verified standalone file, never an editor draft', async () => {
  f.book.monthlyBudget = 12345;
  const result = await executeBackup();
  expect(JSON.parse([...f.files.values()][0]!)).toEqual(f.book);
  expect(result.lastSuccessAt).toBeTruthy();
  expect(result.lastBackgroundSuccessAt).toBeNull();
});
it('old settings migrate without silently enabling background writes', async () => {
  const { background, lastBackgroundSuccessAt, ...old } =
    defaultBackupPreferences();
  const { validateBackupPreferences } =
    await import('../src/domain/automaticBackup');
  expect(validateBackupPreferences(old)).toMatchObject({
    background: false,
    lastBackgroundSuccessAt: null,
  });
  await executeBackup({ background: true, scheduled: true });
  expect(loadLedger).not.toHaveBeenCalled();
  expect(f.files.size).toBe(0);
});
it('background opt-in creates its first verified copy, then respects the chosen interval', async () => {
  f.prefs.background = true;
  f.prefs.lastSuccessAt = new Date().toISOString();
  const next = await executeBackup({ background: true, scheduled: true });
  expect(next.lastBackgroundSuccessAt).toEqual(next.lastSuccessAt);
  expect(f.files.size).toBe(1);
  await executeBackup({ background: true, scheduled: true });
  expect(f.files.size).toBe(1);
  expect(loadLedger).toHaveBeenCalledTimes(1);
});
it('disabled frequency prevents headless I/O even if an old task is still registered', async () => {
  f.prefs.background = true;
  f.prefs.days = 0;
  await executeBackup({ background: true, scheduled: true });
  expect(loadLedger).not.toHaveBeenCalled();
});
it('background disk failure preserves the last successful file and records a visible error', async () => {
  await executeBackup();
  const saved = f.prefs.lastSuccessAt;
  f.prefs.background = true;
  f.fail = true;
  await expect(
    executeBackup({ background: true, scheduled: true }),
  ).rejects.toThrow('磁盘已满');
  expect(f.prefs.lastSuccessAt).toBe(saved);
  expect(f.prefs.lastBackgroundSuccessAt).toBeNull();
  expect(f.prefs.error).toContain('磁盘已满');
  expect(f.files.size).toBe(1);
});
it('expired writers cannot prune files or overwrite settings', async () => {
  const old = { ...f.prefs };
  f.lost = true;
  await expect(executeBackup()).rejects.toThrow('过期');
  expect(backupFiles.remove).not.toHaveBeenCalled();
  expect(f.prefs).toEqual(old);
});
it('configuration updates read current disk preferences so background success is preserved', async () => {
  f.prefs.lastSuccessAt = '2026-11-06T01:00:00.000Z';
  const updated = await changeBackupPreferences((old) => ({ ...old, days: 7 }));
  expect(updated.lastSuccessAt).toBe('2026-11-06T01:00:00.000Z');
  expect(updated.days).toBe(7);
});
it('corrupt persisted money is rejected before file creation', async () => {
  f.book.monthlyBudget = 0.1;
  await expect(executeBackup()).rejects.toThrow();
  expect(backupFiles.write).not.toHaveBeenCalled();
});

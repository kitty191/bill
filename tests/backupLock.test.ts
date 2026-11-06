import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ directory: '', handles: [] as any[] }));
fixture.directory = mkdtempSync(path.join(tmpdir(), 'qingzhang-job-lock-'));
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (name: string) => {
    expect(name).toBe('qingzhang-backup-jobs.db');
    const db = new DatabaseSync(path.join(fixture.directory, name));
    fixture.handles.push(db);
    return {
      execAsync: async (sql: string) => {
        db.exec(sql);
      },
      runAsync: async (sql: string, ...args: SQLInputValue[]) =>
        db.prepare(sql).run(...args),
    };
  },
}));
afterAll(() => {
  for (const db of fixture.handles) db.close();
  rmSync(fixture.directory, { recursive: true, force: true });
});
it('coordinates independent runtimes and prevents an expired owner from releasing the replacement lease', async () => {
  const { withBackupLock: first } = await import('../src/storage/backupLock');
  vi.resetModules();
  const { withBackupLock: second } = await import('../src/storage/backupLock');
  let resume!: () => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000000);
  const old = first(async (renew) => {
    entered();
    await hold;
    await renew();
  });
  const failed = expect(old).rejects.toThrow('过期');
  await ready;
  await expect(second(async () => {})).rejects.toThrow('正在进行');
  clock.mockReturnValue(1000000 + 31 * 60000);
  let release!: () => void, started!: () => void;
  const acquired = new Promise<void>((resolve) => {
    started = resolve;
  });
  const newHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const replacement = second(async (renew) => {
    started();
    await newHold;
    await renew();
    return 'verified';
  });
  await acquired;
  resume();
  await failed;
  await expect(first(async () => {})).rejects.toThrow('正在进行');
  release();
  expect(await replacement).toBe('verified');
  expect(await first(async () => 'next')).toBe('next');
  clock.mockRestore();
});

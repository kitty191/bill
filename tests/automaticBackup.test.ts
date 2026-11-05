import { beforeEach, expect, it, vi } from 'vitest';
import {
  backupDue,
  defaultBackupPreferences,
  ownedBackup,
  validateBackupPreferences,
  writeVerifiedBackup,
  type BackupFiles,
  type BackupPreferences,
} from '../src/domain/automaticBackup';
import { emptyLedger } from '../src/domain/ledger';
const now = new Date('2026-11-05T04:00:00Z');
let preferences: BackupPreferences;
let contents: Map<string, string>;
let files: BackupFiles;
beforeEach(() => {
  preferences = {
    ...defaultBackupPreferences(),
    installationId: 'installation-123',
    directory: 'chosen-folder',
    directoryName: '备份',
    days: 1,
  };
  contents = new Map();
  files = {
    write: vi.fn(async (_, name, payload) => {
      contents.set(name, payload);
      return { name, uri: name };
    }),
    read: vi.fn(async ({ uri }) => {
      if (!contents.has(uri)) throw new Error('授权失效');
      return contents.get(uri)!;
    }),
    list: vi.fn(async () =>
      [...contents.keys()].map((name) => ({ name, uri: name })),
    ),
    remove: vi.fn(async ({ uri }) => {
      contents.delete(uri);
    }),
  };
});
it('is opt-in, validates configuration, retries after clock rollback and backs off failures', () => {
  expect(backupDue(defaultBackupPreferences(), now.getTime())).toBe(false);
  expect(backupDue(preferences, now.getTime())).toBe(true);
  const recent = { ...preferences, lastSuccessAt: now.toISOString() };
  expect(backupDue(recent, now.getTime() + 86399999)).toBe(false);
  expect(backupDue(recent, now.getTime() + 86400000)).toBe(true);
  expect(backupDue(recent, now.getTime() - 1000)).toBe(true);
  expect(
    backupDue(
      { ...preferences, error: '失败', lastAttemptAt: now.toISOString() },
      now.getTime() + 30000,
    ),
  ).toBe(false);
  expect(
    backupDue(
      { ...preferences, error: '失败', lastAttemptAt: now.toISOString() },
      now.getTime() + 60000,
    ),
  ).toBe(true);
  for (const invalid of [
    { ...preferences, installationId: undefined },
    { ...preferences, days: 2 },
    { ...preferences, directory: null },
    { ...preferences, lastSuccessAt: 'invalid' },
  ])
    expect(() => validateBackupPreferences(invalid)).toThrow();
});
it('writes a standalone canonical JSON file, reads it back and keeps only seven valid owned versions', async () => {
  const ledger = emptyLedger();
  ledger.entries = [
    {
      id: 'record',
      kind: 'expense',
      amount: 1234,
      categoryId: 'food',
      accountId: 'wechat',
      date: '2026-11-05',
      note: '中文备注',
      createdAt: now.toISOString(),
    },
  ];
  contents.set('unrelated-user-backup.json', 'private unrelated content');
  contents.set(
    'qingzhang-auto-other-owner-20261001T040000000Z-salt.json',
    JSON.stringify(emptyLedger()),
  );
  const made = [];
  for (let index = 0; index < 10; index++) {
    const result = await writeVerifiedBackup(
      files,
      preferences,
      ledger,
      new Date(now.getTime() + index * 86400000),
    );
    made.push(result.file.name);
    expect(result.warning).toBe('');
    expect(result.at).toBe(
      new Date(now.getTime() + index * 86400000).toISOString(),
    );
    expect(JSON.parse(contents.get(result.file.uri)!)).toEqual(ledger);
  }
  expect(
    [...contents.keys()].filter((name) =>
      ownedBackup(name, preferences.installationId),
    ),
  ).toHaveLength(7);
  expect(made.slice(0, 3).every((name) => !contents.has(name))).toBe(true);
  expect(contents.get('unrelated-user-backup.json')).toBe(
    'private unrelated content',
  );
  expect(
    contents.has('qingzhang-auto-other-owner-20261001T040000000Z-salt.json'),
  ).toBe(true);
});
it('a failed write never prunes previous backups or reports success', async () => {
  await writeVerifiedBackup(files, preferences, emptyLedger(), now);
  const before = new Map(contents);
  vi.mocked(files.write).mockRejectedValueOnce(new Error('磁盘已满'));
  await expect(
    writeVerifiedBackup(files, preferences, emptyLedger(), now),
  ).rejects.toThrow('磁盘已满');
  expect(contents).toEqual(before);
  expect(files.remove).not.toHaveBeenCalled();
});
it('readback mismatch removes only the newly created file, preserving the earlier good copy', async () => {
  const first = await writeVerifiedBackup(
    files,
    preferences,
    emptyLedger(),
    now,
  );
  vi.mocked(files.read).mockResolvedValueOnce('{"truncated":');
  await expect(
    writeVerifiedBackup(
      files,
      preferences,
      emptyLedger(),
      new Date(now.getTime() + 1),
    ),
  ).rejects.toThrow('回读校验失败');
  expect(contents.size).toBe(1);
  expect(contents.has(first.file.uri)).toBe(true);
});
it('interrupted or corrupt archives cannot evict good versions and a clock rollback cannot delete the fresh backup', async () => {
  for (let index = 0; index < 7; index++)
    await writeVerifiedBackup(
      files,
      preferences,
      emptyLedger(),
      new Date(now.getTime() + index * 86400000),
    );
  const bad =
    'qingzhang-auto-installation-123-20990101T000000000Z-incomplete.json';
  contents.set(bad, '{');
  const result = await writeVerifiedBackup(
    files,
    preferences,
    emptyLedger(),
    new Date('2020-01-01T00:00:00Z'),
  );
  expect(contents.has(result.file.uri)).toBe(true);
  expect(contents.get(bad)).toBe('{');
  expect(
    [...contents].filter(
      ([name, value]) =>
        ownedBackup(name, preferences.installationId) && value !== '{',
    ),
  ).toHaveLength(7);
});
it('a cleanup failure retains the verified new backup and reports a warning', async () => {
  for (let index = 0; index < 7; index++)
    await writeVerifiedBackup(
      files,
      preferences,
      emptyLedger(),
      new Date(now.getTime() + index * 86400000),
    );
  vi.mocked(files.remove).mockRejectedValueOnce(new Error('不允许删除'));
  const result = await writeVerifiedBackup(
    files,
    preferences,
    emptyLedger(),
    new Date(now.getTime() + 8 * 86400000),
  );
  expect(result.warning).toContain('旧版本清理未完成');
  expect(contents.has(result.file.uri)).toBe(true);
  expect(contents.size).toBe(8);
});
it('rejects invalid financial input before creating a file', async () => {
  const ledger = emptyLedger();
  ledger.monthlyBudget = 0.1;
  await expect(
    writeVerifiedBackup(files, preferences, ledger, now),
  ).rejects.toThrow();
  expect(files.write).not.toHaveBeenCalled();
});

import { id, type Ledger, validateLedger } from './ledger';
import { assertBackupTextSize } from './backup';

export type BackupPreferences = {
  version: 1;
  installationId: string;
  days: 0 | 1 | 7 | 30;
  directory: string | null;
  directoryName: string;
  lastSuccessAt: string | null;
  lastFileName: string | null;
  lastAttemptAt: string | null;
  error: string;
};
export const BACKUP_VERSIONS = 7;
export function defaultBackupPreferences(): BackupPreferences {
  return {
    version: 1,
    installationId: id(),
    days: 0,
    directory: null,
    directoryName: '',
    lastSuccessAt: null,
    lastFileName: null,
    lastAttemptAt: null,
    error: '',
  };
}
export function validateBackupPreferences(input: unknown): BackupPreferences {
  if (!input || typeof input !== 'object') throw new Error('自动备份设置无效');
  const v = input as BackupPreferences;
  if (
    v.version !== 1 ||
    typeof v.installationId !== 'string' ||
    !/^[a-z0-9-]{6,100}$/.test(v.installationId) ||
    ![0, 1, 7, 30].includes(v.days) ||
    (v.directory !== null &&
      (typeof v.directory !== 'string' ||
        !v.directory ||
        v.directory.length > 4000)) ||
    typeof v.directoryName !== 'string' ||
    v.directoryName.length > 120 ||
    typeof v.error !== 'string' ||
    v.error.length > 500 ||
    (v.lastFileName !== null &&
      (typeof v.lastFileName !== 'string' || v.lastFileName.length > 200))
  )
    throw new Error('自动备份设置无效');
  for (const time of [v.lastSuccessAt, v.lastAttemptAt])
    if (
      time !== null &&
      (typeof time !== 'string' || !Number.isFinite(Date.parse(time)))
    )
      throw new Error('自动备份日期无效');
  if (v.days && !v.directory) throw new Error('请先选择备份目录');
  return {
    version: 1,
    installationId: v.installationId,
    days: v.days,
    directory: v.directory,
    directoryName: v.directoryName,
    lastSuccessAt: v.lastSuccessAt,
    lastFileName: v.lastFileName,
    lastAttemptAt: v.lastAttemptAt,
    error: v.error,
  };
}
export function backupDue(p: BackupPreferences, now = Date.now()) {
  if (!p.days || !p.directory) return false;
  const last = p.lastSuccessAt ? Date.parse(p.lastSuccessAt) : null;
  if (
    p.error &&
    p.lastAttemptAt &&
    now >= Date.parse(p.lastAttemptAt) &&
    now - Date.parse(p.lastAttemptAt) < 60000
  )
    return false;
  return last === null || now < last || now - last >= p.days * 86400000;
}
export type BackupFile = { name: string; uri: string };
export type BackupFiles = {
  write: (
    directory: string,
    name: string,
    content: string,
  ) => Promise<BackupFile>;
  read: (file: BackupFile) => Promise<string>;
  list: (directory: string) => Promise<BackupFile[]>;
  remove: (file: BackupFile) => Promise<void>;
};
export function ownedBackup(name: string, installationId: string) {
  return (
    /^[a-z0-9-]{6,100}$/.test(installationId) &&
    new RegExp(
      `^qingzhang-auto-${installationId}-\\d{8}T\\d{9}Z-[a-z0-9-]+\\.json$`,
    ).test(name)
  );
}
export async function writeVerifiedBackup(
  files: BackupFiles,
  p: BackupPreferences,
  ledger: Ledger,
  now = new Date(),
): Promise<{ file: BackupFile; at: string; warning: string }> {
  if (!p.directory) throw new Error('请先选择备份目录');
  const payload = JSON.stringify(validateLedger(ledger));
  assertBackupTextSize(payload);
  const stamp = now.toISOString().replace(/[-:.]/g, '');
  const name = `qingzhang-auto-${p.installationId}-${stamp}-${id()}.json`;
  let file: BackupFile | null = null;
  try {
    file = await files.write(p.directory, name, payload);
    if ((await files.read(file)) !== payload)
      throw new Error('备份文件回读校验失败');
  } catch (error) {
    if (file) await files.remove(file).catch(() => {});
    throw new Error(
      `自动备份未完成：${error instanceof Error ? error.message : '无法写入所选目录'}。请检查目录授权和剩余空间。`,
    );
  }
  // A fresh, verified copy exists before pruning. Only our installation's
  // valid JSON archives count toward retention; interrupted files cannot evict
  // good versions, and unrelated files are never removed.
  let warning = '';
  try {
    const candidates = (await files.list(p.directory))
      .filter(
        (item) =>
          item.uri !== file!.uri && ownedBackup(item.name, p.installationId),
      )
      .sort((a, b) => b.name.localeCompare(a.name));
    let kept = 1;
    for (const item of candidates) {
      try {
        const text = await files.read(item);
        assertBackupTextSize(text);
        validateLedger(JSON.parse(text));
      } catch {
        continue;
      }
      if (kept++ >= BACKUP_VERSIONS) await files.remove(item);
    }
  } catch {
    warning = '新备份已保存，旧版本清理未完成，请检查目录权限';
  }
  return { file, at: now.toISOString(), warning };
}

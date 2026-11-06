import {
  backupDue,
  validateBackupPreferences,
  writeVerifiedBackup,
  type BackupFiles,
  type BackupPreferences,
} from '../domain/automaticBackup';
import {
  backupFiles,
  loadBackupPreferences,
  saveBackupPreferences,
} from './automaticBackup';
import { loadLedger } from './ledgerStore';
import { withBackupLock } from './backupLock';

export async function changeBackupPreferences(
  change: (value: BackupPreferences) => BackupPreferences,
) {
  return withBackupLock(async () => {
    const next = validateBackupPreferences(
      change(await loadBackupPreferences()),
    );
    await saveBackupPreferences(next);
    return next;
  });
}
export async function resetBackupPreferences(value: BackupPreferences) {
  return withBackupLock(async () => {
    await saveBackupPreferences(value);
    return value;
  });
}
export async function executeBackup(
  options: { scheduled?: boolean; background?: boolean } = {},
) {
  return withBackupLock(async (renew) => {
    const old = await loadBackupPreferences();
    if (
      (options.background &&
        (!old.background || !old.days || !old.directory)) ||
      (options.scheduled &&
        !backupDue(old) &&
        !(options.background && !old.lastBackgroundSuccessAt))
    )
      return old;
    const attemptedAt = new Date().toISOString();
    // Recheck ownership before every document operation and preference write.
    // A suspended/expired writer cannot prune files or overwrite newer settings.
    const files: BackupFiles = {
      write: async (...args) => {
        await renew();
        return backupFiles.write(...args);
      },
      read: async (...args) => {
        await renew();
        return backupFiles.read(...args);
      },
      list: async (...args) => {
        await renew();
        return backupFiles.list(...args);
      },
      remove: async (...args) => {
        await renew();
        return backupFiles.remove(...args);
      },
    };
    try {
      const result = await writeVerifiedBackup(files, old, await loadLedger());
      await renew();
      const next = {
        ...old,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: result.at,
        lastFileName: result.file.name,
        lastBackgroundSuccessAt: options.background
          ? result.at
          : old.lastBackgroundSuccessAt,
        error: result.warning,
      };
      await saveBackupPreferences(next);
      return next;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : '自动备份失败';
      await renew()
        .then(() =>
          saveBackupPreferences({
            ...old,
            lastAttemptAt: attemptedAt,
            error: message,
          }),
        )
        .catch(() => {});
      throw error;
    }
  });
}

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import type { BackupPreferences } from '../domain/automaticBackup';
import { executeBackup } from '../storage/backupJob';
export const backgroundBackupSupported = true;
export type BackgroundStatus = 'off' | 'scheduled' | 'unsupported';
export const BACKUP_TASK = 'qingzhang-automatic-file-backup-v1';

// Defined during bundle evaluation so WorkManager can start a headless runtime.
if (!TaskManager.isTaskDefined(BACKUP_TASK))
  TaskManager.defineTask(BACKUP_TASK, async ({ error }) => {
    if (error) return BackgroundTask.BackgroundTaskResult.Failed;
    try {
      await executeBackup({ scheduled: true, background: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
let scheduling: Promise<unknown> = Promise.resolve();
export function syncBackgroundBackup(
  preferences: BackupPreferences,
): Promise<BackgroundStatus> {
  const result = scheduling
    .catch(() => {})
    .then(async (): Promise<BackgroundStatus> => {
      if (
        !preferences.background ||
        !preferences.days ||
        !preferences.directory
      ) {
        await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
        return 'off';
      }
      if (
        !(await TaskManager.isAvailableAsync()) ||
        (await BackgroundTask.getStatusAsync()) !==
          BackgroundTask.BackgroundTaskStatus.Available
      )
        throw new Error('系统暂不允许后台备份，仍可在前台备份');
      await BackgroundTask.registerTaskAsync(BACKUP_TASK, {
        minimumInterval: 60,
      });
      if (!(await TaskManager.isTaskRegisteredAsync(BACKUP_TASK)))
        throw new Error('后台备份未能加入系统调度，请重试');
      return 'scheduled';
    });
  scheduling = result;
  return result;
}

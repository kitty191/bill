import type { BackupPreferences } from '../domain/automaticBackup';
export const backgroundBackupSupported = false;
export type BackgroundStatus = 'off' | 'scheduled' | 'unsupported';
export async function syncBackgroundBackup(
  _preferences: BackupPreferences,
): Promise<BackgroundStatus> {
  return 'unsupported';
}

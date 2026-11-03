export type DevicePreferences = {
  version: 1;
  hideAmounts: boolean;
  appLockEnabled: boolean;
  backupReminderDays: 0 | 7 | 30;
  reminderStartedAt: string | null;
  lastExportAt: string | null;
  snoozeUntil: string | null;
};
export function defaultPreferences(): DevicePreferences {
  return {
    version: 1,
    hideAmounts: false,
    appLockEnabled: false,
    backupReminderDays: 0,
    reminderStartedAt: null,
    lastExportAt: null,
    snoozeUntil: null,
  };
}
export function validatePreferences(input: unknown): DevicePreferences {
  if (!input || typeof input !== 'object') throw new Error('隐私设置格式无效');
  const p = input as Record<string, unknown>;
  if (
    p.version !== 1 ||
    typeof p.hideAmounts !== 'boolean' ||
    typeof p.appLockEnabled !== 'boolean' ||
    ![0, 7, 30].includes(p.backupReminderDays as number)
  )
    throw new Error('隐私设置无效');
  for (const field of ['reminderStartedAt', 'lastExportAt', 'snoozeUntil'])
    if (
      p[field] !== null &&
      (typeof p[field] !== 'string' ||
        !Number.isFinite(Date.parse(p[field] as string)))
    )
      throw new Error('备份提醒日期无效');
  return {
    version: 1,
    hideAmounts: p.hideAmounts,
    appLockEnabled: p.appLockEnabled,
    backupReminderDays:
      p.backupReminderDays as DevicePreferences['backupReminderDays'],
    reminderStartedAt: p.reminderStartedAt as string | null,
    lastExportAt: p.lastExportAt as string | null,
    snoozeUntil: p.snoozeUntil as string | null,
  };
}
export function backupReminderDue(
  preferences: DevicePreferences,
  now = Date.now(),
): boolean {
  if (!preferences.backupReminderDays || !preferences.reminderStartedAt)
    return false;
  if (preferences.snoozeUntil && Date.parse(preferences.snoozeUntil) > now)
    return false;
  const last = preferences.lastExportAt ?? preferences.reminderStartedAt;
  return now - Date.parse(last) >= preferences.backupReminderDays * 86_400_000;
}

import {
  defaultPreferences,
  validatePreferences,
  type DevicePreferences,
} from '../domain/privacy';
const key = 'qingzhang.device-preferences.v1';
export const supportsAppLock = false;
export async function loadPreferences() {
  const raw = localStorage.getItem(key);
  const value =
    raw === null ? defaultPreferences() : validatePreferences(JSON.parse(raw));
  return { ...value, appLockEnabled: false };
}
export async function savePreferences(value: DevicePreferences) {
  localStorage.setItem(
    key,
    JSON.stringify({ ...validatePreferences(value), appLockEnabled: false }),
  );
}
export async function authenticateDevice(_enabling = false): Promise<boolean> {
  throw new Error('应用锁仅在手机独立安装版可用');
}

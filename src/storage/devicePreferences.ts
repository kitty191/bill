import * as SecureStore from 'expo-secure-store';
import * as Authentication from 'expo-local-authentication';
import {
  defaultPreferences,
  validatePreferences,
  type DevicePreferences,
} from '../domain/privacy';

const key = 'qingzhang.device-preferences.v1';
export const supportsAppLock = true;
export async function loadPreferences() {
  const raw = await SecureStore.getItemAsync(key);
  return raw === null
    ? defaultPreferences()
    : validatePreferences(JSON.parse(raw));
}
export async function savePreferences(value: DevicePreferences) {
  await SecureStore.setItemAsync(
    key,
    JSON.stringify(validatePreferences(value)),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
}
export async function authenticateDevice(enabling = false): Promise<boolean> {
  if (
    enabling &&
    (!(await Authentication.hasHardwareAsync()) ||
      !(await Authentication.isEnrolledAsync()))
  )
    throw new Error('请先在系统中设置指纹或面容验证');
  const result = await Authentication.authenticateAsync({
    promptMessage: enabling ? '验证身份，开启清账应用锁' : '解锁清账',
    cancelLabel: '取消',
    fallbackLabel: '使用设备密码',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });
  if (
    !result.success &&
    result.error !== 'user_cancel' &&
    result.error !== 'app_cancel' &&
    result.error !== 'system_cancel'
  )
    throw new Error('暂时无法验证，请使用系统验证方式重试');
  return result.success;
}

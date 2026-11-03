import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  hardware: vi.fn(),
  enrolled: vi.fn(),
  authenticate: vi.fn(),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.get,
  setItemAsync: mocks.set,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
}));
vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: mocks.hardware,
  isEnrolledAsync: mocks.enrolled,
  authenticateAsync: mocks.authenticate,
}));
import {
  authenticateDevice,
  loadPreferences,
  savePreferences,
} from '../src/storage/devicePreferences';
import { defaultPreferences } from '../src/domain/privacy';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.hardware.mockResolvedValue(true);
  mocks.enrolled.mockResolvedValue(true);
  mocks.authenticate.mockResolvedValue({ success: true });
});
describe('native system authentication boundary', () => {
  it('does not request biometrics just to load settings', async () => {
    mocks.get.mockResolvedValue(null);
    expect(await loadPreferences()).toEqual(defaultPreferences());
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it('fails closed on unreadable or corrupted settings', async () => {
    mocks.get.mockResolvedValue('{"version":1}');
    await expect(loadPreferences()).rejects.toThrow();
    mocks.get.mockRejectedValue(new Error('unavailable'));
    await expect(loadPreferences()).rejects.toThrow();
  });
  it('requires enrolled hardware before enabling and accepts only successful system proof', async () => {
    mocks.enrolled.mockResolvedValue(false);
    await expect(authenticateDevice(true)).rejects.toThrow('设置指纹');
    expect(mocks.authenticate).not.toHaveBeenCalled();
    mocks.enrolled.mockResolvedValue(true);
    expect(await authenticateDevice(true)).toBe(true);
    expect(mocks.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        disableDeviceFallback: false,
        biometricsSecurityLevel: 'strong',
      }),
    );
    mocks.authenticate.mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    expect(await authenticateDevice()).toBe(false);
    mocks.authenticate.mockResolvedValue({ success: false, error: 'lockout' });
    await expect(authenticateDevice()).rejects.toThrow();
  });
  it('keeps device preferences in device-bound secure storage', async () => {
    const value = { ...defaultPreferences(), appLockEnabled: true };
    await savePreferences(value);
    expect(mocks.set).toHaveBeenCalledWith(
      'qingzhang.device-preferences.v1',
      JSON.stringify(value),
      { keychainAccessible: 6 },
    );
  });
});

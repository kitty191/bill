import { beforeEach, expect, it, vi } from 'vitest';
import { defaultBackupPreferences } from '../src/domain/automaticBackup';
const state = vi.hoisted(() => ({
  registered: false,
  available: true,
  callback: null as any,
  fail: false,
}));
vi.mock('expo-task-manager', () => ({
  isTaskDefined: () => false,
  defineTask: vi.fn((_name, callback) => {
    state.callback = callback;
  }),
  isAvailableAsync: async () => state.available,
  isTaskRegisteredAsync: async () => state.registered,
}));
vi.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Available: 2 },
  getStatusAsync: async () => (state.available ? 2 : 1),
  registerTaskAsync: vi.fn(async () => {
    state.registered = true;
  }),
  unregisterTaskAsync: vi.fn(async () => {
    state.registered = false;
  }),
}));
vi.mock('../src/storage/backupJob', () => ({
  executeBackup: vi.fn(async () => {
    if (state.fail) throw new Error('权限失效');
  }),
}));
import {
  syncBackgroundBackup,
  BACKUP_TASK,
} from '../src/background/backgroundBackup.android';
import { executeBackup } from '../src/storage/backupJob';
import { registerTaskAsync } from 'expo-background-task';
beforeEach(() => {
  state.registered = false;
  state.available = true;
  state.fail = false;
  vi.clearAllMocks();
});
const enabled = () => ({
  ...defaultBackupPreferences(),
  days: 1 as const,
  directory: 'folder',
  background: true,
});
it('defines the headless callback at module evaluation and reports execution failures', async () => {
  expect(state.callback).toBeTypeOf('function');
  expect(await state.callback({})).toBe(1);
  expect(executeBackup).toHaveBeenCalledWith({
    scheduled: true,
    background: true,
  });
  state.fail = true;
  expect(await state.callback({})).toBe(2);
  expect(await state.callback({ error: new Error('系统中断') })).toBe(2);
});
it('registers only with explicit opt-in, directory and frequency and serializes rapid toggles', async () => {
  expect(await syncBackgroundBackup(defaultBackupPreferences())).toBe('off');
  expect(registerTaskAsync).not.toHaveBeenCalled();
  expect(await syncBackgroundBackup(enabled())).toBe('scheduled');
  expect(registerTaskAsync).toHaveBeenCalledWith(BACKUP_TASK, {
    minimumInterval: 60,
  });
  await Promise.all([
    syncBackgroundBackup(enabled()),
    syncBackgroundBackup(defaultBackupPreferences()),
  ]);
  expect(state.registered).toBe(false);
});
it('restricted scheduling stays visibly unsuccessful and can be retried', async () => {
  state.available = false;
  await expect(syncBackgroundBackup(enabled())).rejects.toThrow('系统暂不允许');
  expect(state.registered).toBe(false);
  state.available = true;
  expect(await syncBackgroundBackup(enabled())).toBe('scheduled');
});

import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPreferences } from '../src/domain/privacy';

const mocks = vi.hoisted(() => ({
  appState: { currentState: 'active', addEventListener: vi.fn() },
  load: vi.fn(),
  save: vi.fn(),
  authenticate: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: mocks.appState }));
vi.mock('../src/storage/devicePreferences', () => ({
  supportsAppLock: true,
  loadPreferences: mocks.load,
  savePreferences: mocks.save,
  authenticateDevice: mocks.authenticate,
}));
import { PrivacyProvider } from '../src/state/PrivacyProvider';
import { usePrivacy, type PrivacyState } from '../src/state/PrivacyContext';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let state: PrivacyState;
let renderer: ReactTestRenderer | undefined;
let listener: (state: string) => void;
function Probe() {
  state = usePrivacy();
  return null;
}
async function mount(locked = false) {
  mocks.load.mockResolvedValue({
    ...defaultPreferences(),
    appLockEnabled: locked,
  });
  await act(async () => {
    renderer = create(
      <PrivacyProvider>
        <Probe />
      </PrivacyProvider>,
    );
  });
}
async function changeAppState(next: string) {
  await act(async () => {
    mocks.appState.currentState = next;
    listener(next);
  });
}
async function unlocked() {
  await mount(true);
  await act(async () => {
    await state.unlock();
  });
  expect(state.phase).toBe('unlocked');
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.appState.currentState = 'active';
  mocks.appState.addEventListener.mockImplementation((_event, callback) => {
    listener = callback;
    return { remove: vi.fn() };
  });
  mocks.save.mockResolvedValue(undefined);
  mocks.authenticate.mockResolvedValue(true);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
});

describe('device lock lifecycle', () => {
  it('loads locked, stays locked on cancellation and only unlocks with successful proof', async () => {
    await mount(true);
    expect(state.phase).toBe('locked');
    expect(mocks.authenticate).not.toHaveBeenCalled();
    mocks.authenticate.mockResolvedValueOnce(false);
    await act(async () => {
      await state.unlock();
    });
    expect(state.phase).toBe('locked');
    expect(state.error).toContain('取消');
    await act(async () => {
      await state.unlock();
    });
    expect(state.phase).toBe('unlocked');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('locks again after backgrounding but ignores inactive system sheets', async () => {
    await unlocked();
    await changeAppState('inactive');
    expect(state.phase).toBe('unlocked');
    await changeAppState('active');
    await changeAppState('background');
    expect(state.phase).toBe('locked');
    await changeAppState('active');
    expect(state.phase).toBe('locked');
    await act(async () => {
      await state.unlock();
    });
    expect(state.phase).toBe('unlocked');
  });
  it('does not enable a lock after cancelled authentication or failed preference persistence', async () => {
    await mount();
    mocks.authenticate.mockResolvedValueOnce(false);
    await act(async () => {
      await expect(state.setAppLock(true)).rejects.toThrow('取消');
    });
    expect(state.preferences.appLockEnabled).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.save.mockRejectedValueOnce(new Error('写入失败'));
    await act(async () => {
      await expect(state.setAppLock(true)).rejects.toThrow('写入失败');
    });
    expect(state.preferences.appLockEnabled).toBe(false);
    expect(state.phase).toBe('unlocked');
  });
  it.each(['cancel', 'error', 'save-failure'] as const)(
    'keeps the lock after a backgrounded disable attempt ends with %s',
    async (outcome) => {
      await unlocked();
      let finish!: (verified: boolean) => void;
      let fail!: (error: Error) => void;
      mocks.authenticate.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
      );
      let task!: Promise<void>;
      let failure = '';
      await act(async () => {
        task = state.setAppLock(false).catch((error) => {
          failure = error.message;
        });
      });
      await changeAppState('background');
      // Return before the system callback settles: the original bug left this session open.
      await changeAppState('active');
      if (outcome === 'save-failure')
        mocks.save.mockRejectedValueOnce(new Error('写入失败'));
      await act(async () => {
        if (outcome === 'error') fail(new Error('验证失败'));
        else finish(outcome === 'save-failure');
        await task;
      });
      expect(failure).not.toBe('');
      expect(state.preferences.appLockEnabled).toBe(true);
      expect(state.phase).toBe('locked');
    },
  );
  it('allows a verified disable after a system authentication activity returns', async () => {
    await unlocked();
    let finish!: (verified: boolean) => void;
    mocks.authenticate.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    let task!: Promise<void>;
    await act(async () => {
      task = state.setAppLock(false);
    });
    await changeAppState('background');
    await changeAppState('active');
    await act(async () => {
      finish(true);
      await task;
    });
    expect(state.preferences.appLockEnabled).toBe(false);
    expect(state.phase).toBe('unlocked');
  });
  it('rejects attempts to bypass authentication through a generic preferences update', async () => {
    await mount();
    await act(async () => {
      await expect(
        state.update((value) => ({ ...value, appLockEnabled: true })),
      ).rejects.toThrow('身份验证');
    });
    expect(state.preferences.appLockEnabled).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('fails closed when preferences cannot be read and can explicitly retry', async () => {
    mocks.load.mockRejectedValueOnce(new Error('损坏'));
    await act(async () => {
      renderer = create(
        <PrivacyProvider>
          <Probe />
        </PrivacyProvider>,
      );
    });
    expect(state.phase).toBe('error');
    mocks.load.mockResolvedValue({
      ...defaultPreferences(),
      appLockEnabled: true,
    });
    await act(async () => {
      state.reload();
    });
    expect(state.phase).toBe('locked');
  });
});

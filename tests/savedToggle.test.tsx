import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedToggle } from '../src/state/useSavedToggle';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
let toggle: ReturnType<typeof useSavedToggle>;
function Probe({
  value,
  save,
}: {
  value: boolean;
  save: (value: boolean) => Promise<void>;
}) {
  toggle = useSavedToggle(value, save);
  return null;
}
async function mount(save: (value: boolean) => Promise<void>) {
  await act(async () => {
    renderer = create(<Probe value={false} save={save} />);
  });
}
async function tap(value: boolean) {
  await act(async () => {
    toggle.onValueChange(value);
  });
}
async function startSave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});
describe('responsive persisted switch', () => {
  it('updates the control before storage starts and does not roll back while storage is pending', async () => {
    let finish!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await mount(save);
    await tap(true);
    expect(toggle.value).toBe(true);
    expect(save).not.toHaveBeenCalled();
    await startSave();
    expect(toggle.value).toBe(true);
    await act(async () => {
      finish();
    });
    expect(toggle.value).toBe(true);
    expect(toggle.error).toBe('');
  });
  it('coalesces taps before a write and persists the latest tap after a running write', async () => {
    let finish!: () => void;
    const save = vi
      .fn<(value: boolean) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    await mount(save);
    await tap(true);
    await tap(false);
    await startSave();
    expect(save).not.toHaveBeenCalled();
    await tap(true);
    await startSave();
    await tap(false);
    expect(toggle.value).toBe(false);
    expect(save.mock.calls).toEqual([[true]]);
    await act(async () => {
      finish();
    });
    expect(save.mock.calls).toEqual([[true], [false]]);
    expect(toggle.value).toBe(false);
  });
  it('rolls back a failed save, shows its error and allows retry', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('存储空间不足'))
      .mockResolvedValue(undefined);
    await mount(save);
    await tap(true);
    await startSave();
    expect(toggle.value).toBe(false);
    expect(toggle.error).toContain('存储空间不足');
    await tap(true);
    await startSave();
    expect(toggle.value).toBe(true);
    expect(toggle.error).toBe('');
  });
  it('retains newer input when an older save fails', async () => {
    let fail!: (error: Error) => void;
    const save = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    await mount(save);
    await tap(true);
    await startSave();
    await tap(false);
    await act(async () => {
      fail(new Error('失败'));
    });
    expect(toggle.value).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('syncs imported settings when idle and finishes the last desired write after closing', async () => {
    let finish!: () => void;
    const save = vi
      .fn<(value: boolean) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    await mount(save);
    await act(async () => {
      renderer.update(<Probe value={true} save={save} />);
    });
    expect(toggle.value).toBe(true);
    await tap(false);
    await startSave();
    await tap(true);
    await act(async () => {
      renderer.unmount();
      finish();
    });
    expect(save.mock.calls).toEqual([[false], [true]]);
  });
});

import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLedger, type Ledger } from '../src/domain/ledger';
const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('../src/storage/ledgerStore', () => ({
  loadLedger: mocks.load,
  saveLedger: mocks.save,
}));
import { LedgerProvider, useLedger } from '../src/state/LedgerProvider';
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
let state: ReturnType<typeof useLedger>;
function Probe() {
  state = useLedger();
  return null;
}
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(emptyLedger());
  mocks.save.mockResolvedValue(undefined);
  await act(async () => {
    renderer = create(
      <LedgerProvider>
        <Probe />
      </LedgerProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
describe('ledger write serialization', () => {
  it('keeps the last switch intent when its settings consumer closes and reopens during a write', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => {
      state.accountDisplay.onValueChange(true);
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(state.accountDisplay.value).toBe(true);
    expect(state.saving).toBe(false);
    await act(async () => {
      renderer.update(
        <LedgerProvider>
          <Probe key="reopened" />
        </LedgerProvider>,
      );
    });
    expect(state.accountDisplay.value).toBe(true);
    await act(async () => {
      state.accountDisplay.onValueChange(false);
      finish();
    });
    expect(
      mocks.save.mock.calls.map(([value]) => value.showAccountCards),
    ).toEqual([true, false]);
    expect(state.accountDisplay.value).toBe(false);
    expect(state.ledger!.showAccountCards).toBe(false);
  });
  it('keeps settings interactive during background writes and commits only after storage succeeds', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let task!: Promise<void>;
    await act(async () => {
      task = state.update((value) => ({ ...value, showAccountCards: true }), {
        background: true,
      });
    });
    expect(state.saving).toBe(false);
    expect(state.ledger!.showAccountCards).toBe(false);
    await act(async () => {
      finish();
      await task;
    });
    expect(state.ledger!.showAccountCards).toBe(true);
  });
  it('serializes settings and financial writes against the latest committed ledger', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let display!: Promise<void>, budget!: Promise<void>;
    await act(async () => {
      display = state.update(
        (value) => ({ ...value, showAccountCards: true }),
        { background: true },
      );
    });
    await act(async () => {
      budget = state.update((value) => ({ ...value, monthlyBudget: 123400 }));
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(state.saving).toBe(true);
    await act(async () => {
      finish();
      await Promise.all([display, budget]);
    });
    expect(state.ledger).toMatchObject({
      showAccountCards: true,
      monthlyBudget: 123400,
    });
    expect(mocks.save.mock.calls[1]![0]).toMatchObject({
      showAccountCards: true,
      monthlyBudget: 123400,
    });
  });
  it('preserves data and an error after background failure, then accepts later writes', async () => {
    const original = state.ledger;
    mocks.save.mockRejectedValueOnce(new Error('写入失败'));
    await act(async () => {
      await expect(
        state.update((value) => ({ ...value, showAccountCards: true }), {
          background: true,
        }),
      ).rejects.toThrow('写入失败');
    });
    expect(state.ledger).toBe(original);
    expect(state.backgroundError).toBe('写入失败');
    expect(state.saving).toBe(false);
    await act(async () => {
      await state.update((value) => ({ ...value, monthlyBudget: 100 }));
    });
    expect(state.ledger).toMatchObject({
      monthlyBudget: 100,
      showAccountCards: false,
    });
  });
  it('retains foreground double-save protection and supports recovery', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let first!: Promise<void>;
    await act(async () => {
      first = state.update((value) => ({ ...value, monthlyBudget: 100 }));
    });
    await act(async () => {
      await expect(state.update((value) => value)).rejects.toThrow('正在保存');
    });
    await act(async () => {
      finish();
      await first;
    });
    const recovery: Ledger = { ...emptyLedger(), monthlyBudget: 500 };
    await act(async () => {
      await state.recover(recovery);
    });
    expect(state.ledger).toEqual(recovery);
    expect(state.saving).toBe(false);
  });
});

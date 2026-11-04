import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyLedger,
  upsertEntry,
  type Entry,
  type Ledger,
} from '../src/domain/ledger';
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  snapshots: vi.fn(),
  clearSnapshots: vi.fn(),
}));
vi.mock('../src/storage/ledgerStore', () => ({
  loadLedger: mocks.load,
  saveLedger: mocks.save,
  loadSnapshots: mocks.snapshots,
  clearSnapshots: mocks.clearSnapshots,
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
  mocks.snapshots.mockResolvedValue([]);
  mocks.clearSnapshots.mockResolvedValue(undefined);
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
  vi.useRealTimers();
});

const expense: Entry = {
  id: 'expense',
  kind: 'expense',
  amount: 10000,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-11-01',
  note: '可撤销账单',
  createdAt: '2026-11-01T10:00:00Z',
};
async function seedEntries(entries: Entry[]) {
  await act(async () => {
    await state.update((ledger) => ({ ...ledger, entries }));
  });
}
describe('durable deletion undo', () => {
  it('restores the exact deleted record without losing intervening writes', async () => {
    await seedEntries([expense]);
    await act(async () => {
      await state.removeEntry(expense.id);
    });
    expect(state.ledger!.entries).toEqual([]);
    expect(state.undo?.entry).toEqual(expense);
    const income: Entry = {
      ...expense,
      id: 'income',
      kind: 'income',
      categoryId: 'salary',
      amount: 1000,
    };
    await act(async () => {
      await state.update((ledger) => upsertEntry(ledger, income));
      await state.restoreDeleted();
    });
    expect(state.ledger!.entries).toEqual([income, expense]);
    expect(state.undo).toBeNull();
  });
  it('keeps both committed data and undo state intact when storage fails', async () => {
    await seedEntries([expense]);
    mocks.save.mockRejectedValueOnce(new Error('保存失败'));
    await act(async () => {
      await expect(state.removeEntry(expense.id)).rejects.toThrow('保存失败');
    });
    expect(state.ledger!.entries).toEqual([expense]);
    expect(state.undo).toBeNull();
    await act(async () => {
      await state.removeEntry(expense.id);
    });
    mocks.save.mockRejectedValueOnce(new Error('恢复失败'));
    await act(async () => {
      await expect(state.restoreDeleted()).rejects.toThrow('恢复失败');
    });
    expect(state.ledger!.entries).toEqual([]);
    expect(state.undo?.entry).toEqual(expense);
    await act(async () => {
      await state.restoreDeleted();
    });
    expect(state.ledger!.entries).toEqual([expense]);
  });
  it('expires after eight wall-clock seconds', async () => {
    vi.useFakeTimers();
    await seedEntries([expense]);
    await act(async () => {
      await state.removeEntry(expense.id);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(state.undo).toBeNull();
    await act(async () => {
      await expect(state.restoreDeleted()).rejects.toThrow('时间已过');
    });
    expect(state.ledger!.entries).toEqual([]);
  });
  it('revalidates refund limits against the current original expense', async () => {
    const refund: Entry = {
      ...expense,
      id: 'refund',
      kind: 'refund',
      amount: 3000,
      originalEntryId: expense.id,
    };
    await seedEntries([expense, refund]);
    await act(async () => {
      await state.removeEntry(refund.id);
      await state.update((ledger) =>
        upsertEntry(ledger, { ...expense, amount: 2000 }),
      );
    });
    await act(async () => {
      await expect(state.restoreDeleted()).rejects.toThrow('累计退款');
    });
    expect(state.ledger!.entries).toEqual([{ ...expense, amount: 2000 }]);
  });
  it('clears the undo token after bulk replacement and backup recovery', async () => {
    await seedEntries([expense]);
    await act(async () => {
      await state.removeEntry(expense.id);
      await state.update(() => emptyLedger(), { resetUndo: true });
    });
    expect(state.undo).toBeNull();
    await seedEntries([expense]);
    await act(async () => {
      await state.removeEntry(expense.id);
      await state.recover(emptyLedger());
    });
    expect(state.undo).toBeNull();
  });
  it('only restores the most recent deletion', async () => {
    const second = { ...expense, id: 'second' };
    await seedEntries([expense, second]);
    await act(async () => {
      await state.removeEntry(expense.id);
      await state.removeEntry(second.id);
      await state.restoreDeleted();
    });
    expect(state.ledger!.entries).toEqual([second]);
  });
  it('does not restore after expiry while waiting behind another write', async () => {
    vi.useFakeTimers();
    await seedEntries([expense]);
    await act(async () => {
      await state.removeEntry(expense.id);
    });
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let quiet!: Promise<void>, restore!: Promise<unknown>;
    await act(async () => {
      quiet = state.update(
        (ledger) => ({ ...ledger, showAccountCards: true }),
        { background: true },
      );
    });
    await act(async () => {
      restore = state.restoreDeleted().catch((error) => error.message);
      await vi.advanceTimersByTimeAsync(8000);
      finish();
      await quiet;
      expect(await restore).toContain('时间已过');
    });
    expect(state.ledger!.entries).toEqual([]);
  });
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

describe('snapshot recovery serialization', () => {
  const snapshot = {
    id: 'snapshot-a',
    createdAt: '2026-11-04T04:00:00Z',
    payload: JSON.stringify({ ...emptyLedger(), monthlyBudget: 12345 }),
  };
  it('does not restore content that changed after the preview was confirmed', async () => {
    mocks.snapshots.mockResolvedValue([
      { ...snapshot, payload: JSON.stringify(emptyLedger()) },
    ]);
    const before = state.ledger;
    await act(async () => {
      await expect(
        state.restoreSnapshot(snapshot.id, snapshot.payload),
      ).rejects.toThrow('已变化');
    });
    expect(state.ledger).toBe(before);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('restores a validated snapshot only after durable save and clears obsolete undo', async () => {
    await seedEntries([expense]);
    await act(async () => {
      await state.removeEntry(expense.id);
    });
    mocks.snapshots.mockResolvedValue([snapshot]);
    mocks.save.mockRejectedValueOnce(new Error('快照保存失败'));
    await act(async () => {
      await expect(state.restoreSnapshot(snapshot.id)).rejects.toThrow(
        '快照保存失败',
      );
    });
    expect(state.ledger!.monthlyBudget).toBe(0);
    expect(state.undo?.entry).toEqual(expense);
    await act(async () => {
      await state.restoreSnapshot(snapshot.id);
    });
    expect(state.ledger!.monthlyBudget).toBe(12345);
    expect(state.undo).toBeNull();
  });
  it('rechecks snapshot existence when its queued restore actually starts', async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    mocks.snapshots.mockResolvedValue([snapshot]);
    let display!: Promise<void>, restore!: Promise<unknown>;
    await act(async () => {
      display = state.update((ledger) => ({ ...ledger, monthlyBudget: 200 }), {
        background: true,
      });
    });
    await act(async () => {
      restore = state
        .restoreSnapshot(snapshot.id)
        .catch((error) => error.message);
      mocks.snapshots.mockResolvedValue([]);
      finish();
      await display;
      expect(await restore).toContain('已不存在');
    });
    expect(state.ledger!.monthlyBudget).toBe(200);
  });
  it('rejects damaged snapshots without writing the main record', async () => {
    const before = state.ledger;
    mocks.snapshots.mockResolvedValue([
      { ...snapshot, payload: '{"version":999}' },
    ]);
    await act(async () => {
      await expect(state.restoreSnapshot(snapshot.id)).rejects.toThrow('版本');
    });
    expect(state.ledger).toBe(before);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(state.saving).toBe(false);
  });
  it('clears only snapshot history and leaves the current book intact, including on failure', async () => {
    await seedEntries([expense]);
    const before = state.ledger;
    mocks.clearSnapshots.mockRejectedValueOnce(new Error('清理失败'));
    await act(async () => {
      await expect(state.clearSnapshotHistory()).rejects.toThrow('清理失败');
    });
    expect(state.ledger).toBe(before);
    expect(state.saving).toBe(false);
    await act(async () => {
      await state.clearSnapshotHistory();
    });
    expect(state.ledger).toBe(before);
    expect(mocks.clearSnapshots).toHaveBeenCalledTimes(2);
  });
  it('projects the recurring switch immediately and rolls it back after write failure', async () => {
    let reject!: (error: Error) => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    await act(async () => {
      state.recurringDisplay.onValueChange(true);
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(state.recurringDisplay.value).toBe(true);
    expect(state.saving).toBe(false);
    expect(state.ledger!.recurringEnabled).toBe(false);
    await act(async () => {
      reject(new Error('设置保存失败'));
    });
    expect(state.recurringDisplay.value).toBe(false);
    expect(state.recurringDisplay.error).toBe('设置保存失败');
  });
});

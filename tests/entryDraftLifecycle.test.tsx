import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EntryDraft } from '../src/domain/entryDraft';
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  clear: vi.fn(),
  listener: null as null | ((state: string) => void),
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      mocks.listener = listener;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('../src/storage/entryDraftStore', () => ({
  saveEntryDraft: mocks.save,
  clearEntryDraft: mocks.clear,
}));
import { useEntryDraft } from '../src/state/useEntryDraft';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer, controls: ReturnType<typeof useEntryDraft>;
const draft: EntryDraft = {
  version: 1,
  id: 'draft-a',
  recordId: 'new-a',
  context: {},
  fields: {
    kind: 'expense',
    calculator: { expression: '', fresh: true, error: '' },
    categoryId: 'food',
    accountId: 'wechat',
    toAccountId: 'alipay',
    date: '2026-11-05',
    note: '',
    saveTemplate: false,
    templateName: '',
  },
};
function Probe({ value }: { value: EntryDraft }) {
  controls = useEntryDraft(value, false);
  return null;
}
beforeEach(async () => {
  vi.useFakeTimers();
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.clear.mockReset().mockResolvedValue(undefined);
  await act(async () => {
    renderer = create(<Probe value={draft} />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
});
const changed = {
  ...draft,
  fields: {
    ...draft.fields,
    calculator: { expression: '12+', fresh: false, error: '' },
  },
};
it('does not replace an existing draft just by opening an untouched editor', async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(151);
  });
  expect(mocks.save).not.toHaveBeenCalled();
});
it('flushes latest incomplete input immediately when the app backgrounds', async () => {
  await act(async () => renderer.update(<Probe value={changed} />));
  await act(async () => mocks.listener!('background'));
  expect(mocks.save).toHaveBeenCalledWith(changed);
});
it('explicit cancel clears by identity and prevents a pending timer from resurrecting it', async () => {
  await act(async () => renderer.update(<Probe value={changed} />));
  await act(async () => controls.cancel());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(mocks.clear).toHaveBeenCalledWith('draft-a');
  expect(mocks.save).not.toHaveBeenCalled();
});
it('waits for the final flush before commit, stops background autosaves, and allows retry after failure', async () => {
  await act(async () => renderer.update(<Probe value={changed} />));
  mocks.save.mockRejectedValueOnce(new Error('磁盘已满'));
  await act(async () => controls.pause());
  await act(async () => {
    mocks.listener!('background');
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  controls.retry();
  await act(async () => mocks.listener!('background'));
  expect(mocks.save).toHaveBeenCalledTimes(2);
});
it('reports autosave failures and refuses silent cancellation if clearing failed', async () => {
  mocks.save.mockRejectedValue(new Error('磁盘已满'));
  mocks.clear.mockRejectedValue(new Error('磁盘已满'));
  await act(async () => renderer.update(<Probe value={changed} />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(151);
  });
  expect(controls.error).toContain('草稿未能自动保存');
  await expect(controls.cancel()).rejects.toThrow('草稿清除失败');
});

it('restarting with a new identity resumes autosave without creating a blank persisted draft', async () => {
  await act(async () => renderer.update(<Probe value={changed} />));
  await act(async () => controls.cancel());
  const fresh = { ...draft, id: 'draft-b', recordId: 'record-b' };
  await act(async () => renderer.update(<Probe value={fresh} />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(151);
  });
  expect(mocks.save).not.toHaveBeenCalled();
  const input = { ...fresh, fields: { ...fresh.fields, note: '新草稿' } };
  await act(async () => renderer.update(<Probe value={input} />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(151);
  });
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(input);
});

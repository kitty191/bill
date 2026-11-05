import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { EntryDraft } from '../domain/entryDraft';
import { clearEntryDraft, saveEntryDraft } from '../storage/entryDraftStore';

export function useEntryDraft(draft: EntryDraft, restored: boolean) {
  const initial = useRef(JSON.stringify(draft));
  const latest = useRef(draft);
  latest.current = draft;
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    const value = latest.current;
    if (!restored && JSON.stringify(value) === initial.current) return;
    await saveEntryDraft(value);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (stopped.current) return;
    timer.current = setTimeout(() => {
      void flushRef.current().then(
        () => setError(''),
        () => setError('草稿未能自动保存，请保留此页面并重试'),
      );
    }, 150);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [JSON.stringify(draft)]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !stopped.current)
        void flushRef
          .current()
          .catch(() => setError('草稿未能自动保存，请保留此页面并重试'));
    });
    return () => subscription.remove();
  }, []);
  return {
    error,
    pause: async () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      // Failed autosave must not stop a valid financial save. Native consumption
      // is atomic with the ledger; the editor still owns the current input.
      await flushRef.current().catch(() => {});
    },
    retry: () => {
      stopped.current = false;
    },
    cancel: async () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      try {
        await clearEntryDraft(draft.id);
      } catch {
        stopped.current = false;
        throw new Error('草稿清除失败，请重试关闭');
      }
    },
  };
}

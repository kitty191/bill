import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type Entry,
  type Ledger,
  validateLedger,
  deleteEntry,
  restoreEntry,
} from '../domain/ledger';
import { loadLedger, saveLedger } from '../storage/ledgerStore';
import { useSavedToggle } from './useSavedToggle';

type Context = {
  ledger: Ledger | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  backgroundError: string;
  accountDisplay: ReturnType<typeof useSavedToggle>;
  undo: { entry: Entry; expiresAt: number } | null;
  removeEntry: (id: string) => Promise<void>;
  restoreDeleted: () => Promise<void>;
  reload: () => void;
  recover: (backup: Ledger) => Promise<void>;
  update: (
    change: (current: Ledger) => Ledger,
    options?: { background?: boolean; resetUndo?: boolean },
  ) => Promise<void>;
};
const LedgerContext = createContext<Context | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState('');
  const [undo, setUndo] = useState<Context['undo']>(null);
  const undoRef = useRef<Context['undo']>(null);
  const clearUndo = useCallback(() => {
    undoRef.current = null;
    setUndo(null);
  }, []);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      clearUndo,
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo, clearUndo]);
  const current = useRef<Ledger | null>(null);
  const pending = useRef(false);
  const writes = useRef(Promise.resolve());
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const task = writes.current.then(operation);
    // A failed write must not prevent the next queued change from being saved.
    writes.current = task.catch(() => {});
    return task;
  }, []);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    loadLedger()
      .then((data) => {
        current.current = data;
        setLedger(data);
      })
      .catch(() => setError('无法读取本地账本。请重试；原数据不会被覆盖。'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  const recover = useCallback(
    async (backup: Ledger) => {
      if (pending.current) throw new Error('账本正在保存，请稍后再试');
      pending.current = true;
      setSaving(true);
      try {
        await enqueue(async () => {
          const next = validateLedger(backup);
          await saveLedger(next);
          current.current = next;
          setLedger(next);
          setError(null);
          clearUndo();
        });
      } finally {
        pending.current = false;
        setSaving(false);
      }
    },
    [enqueue, clearUndo],
  );

  const update = useCallback(
    async (
      change: (data: Ledger) => Ledger,
      options?: { background?: boolean; resetUndo?: boolean },
    ) => {
      const foreground = !options?.background;
      if (!current.current || (foreground && pending.current))
        throw new Error('账本正在保存，请稍后再试');
      if (foreground) {
        pending.current = true;
        setSaving(true);
      } else setBackgroundError('');
      try {
        // Display preferences use the same queue, without dimming or disabling
        // the settings sheet. Each change reads the latest committed ledger.
        await enqueue(async () => {
          const next = validateLedger(change(current.current!));
          await saveLedger(next);
          current.current = next;
          setLedger(next);
          if (options?.resetUndo) clearUndo();
        });
      } catch (failure) {
        if (!foreground)
          setBackgroundError(
            failure instanceof Error ? failure.message : '设置保存失败，请重试',
          );
        throw failure;
      } finally {
        if (foreground) {
          pending.current = false;
          setSaving(false);
        }
      }
    },
    [enqueue, clearUndo],
  );
  const removeEntry = useCallback(
    async (entryId: string) => {
      let removed: Entry | undefined;
      await update((ledger) => {
        removed = ledger.entries.find((entry) => entry.id === entryId);
        if (!removed) throw new Error('账单不存在或已删除');
        return deleteEntry(ledger, entryId);
      });
      const record = { entry: removed!, expiresAt: Date.now() + 8000 };
      undoRef.current = record;
      setUndo(record);
    },
    [update],
  );
  const restoreDeleted = useCallback(async () => {
    const record = undoRef.current;
    if (!record || Date.now() >= record.expiresAt) {
      clearUndo();
      throw new Error('撤销时间已过');
    }
    await update((ledger) => {
      if (undoRef.current !== record || Date.now() >= record.expiresAt)
        throw new Error('撤销时间已过');
      return restoreEntry(ledger, record.entry);
    });
    if (undoRef.current === record) clearUndo();
  }, [update, clearUndo]);
  const saveAccountDisplay = useCallback(
    (showAccountCards: boolean) =>
      update((value) => ({ ...value, showAccountCards }), { background: true }),
    [update],
  );
  // Keep pending intent alive when the settings panel closes or changes pages.
  const accountDisplay = useSavedToggle(
    ledger?.showAccountCards ?? false,
    saveAccountDisplay,
  );
  return (
    <LedgerContext.Provider
      value={{
        ledger,
        loading,
        saving,
        error,
        backgroundError,
        accountDisplay,
        undo,
        removeEntry,
        restoreDeleted,
        reload,
        recover,
        update,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) throw new Error('LedgerProvider is required');
  return context;
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type Ledger, validateLedger } from '../domain/ledger';
import { loadLedger, saveLedger } from '../storage/ledgerStore';
import { useSavedToggle } from './useSavedToggle';

type Context = {
  ledger: Ledger | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  backgroundError: string;
  accountDisplay: ReturnType<typeof useSavedToggle>;
  reload: () => void;
  recover: (backup: Ledger) => Promise<void>;
  update: (
    change: (current: Ledger) => Ledger,
    options?: { background?: boolean },
  ) => Promise<void>;
};
const LedgerContext = createContext<Context | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState('');
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
        });
      } finally {
        pending.current = false;
        setSaving(false);
      }
    },
    [enqueue],
  );

  const update = useCallback(
    async (
      change: (data: Ledger) => Ledger,
      options?: { background?: boolean },
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
    [enqueue],
  );
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

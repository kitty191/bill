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

type Context = {
  ledger: Ledger | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => void;
  recover: (backup: Ledger) => Promise<void>;
  update: (change: (current: Ledger) => Ledger) => Promise<void>;
};
const LedgerContext = createContext<Context | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<Ledger | null>(null);
  const pending = useRef(false);
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

  const recover = useCallback(async (backup: Ledger) => {
    if (pending.current) throw new Error('账本正在保存，请稍后再试');
    pending.current = true;
    setSaving(true);
    try {
      const next = validateLedger(backup);
      await saveLedger(next);
      current.current = next;
      setLedger(next);
      setError(null);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (change: (data: Ledger) => Ledger) => {
    if (!current.current || pending.current)
      throw new Error('账本正在保存，请稍后再试');
    pending.current = true;
    setSaving(true);
    try {
      const next = validateLedger(change(current.current));
      await saveLedger(next);
      current.current = next;
      setLedger(next);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }, []);
  return (
    <LedgerContext.Provider
      value={{ ledger, loading, saving, error, reload, recover, update }}
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

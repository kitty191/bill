import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type BackupPreferences,
  backupDue,
  defaultBackupPreferences,
  writeVerifiedBackup,
} from '../domain/automaticBackup';
import {
  automaticBackupSupported,
  backupFiles,
  loadBackupPreferences,
  pickBackupDirectory,
  saveBackupPreferences,
} from '../storage/automaticBackup';
import { useLedger } from './LedgerProvider';
import { usePrivacy } from './PrivacyContext';

type State = {
  preferences: BackupPreferences | null;
  busy: boolean;
  error: string;
  supported: boolean;
  configure: (days: BackupPreferences['days']) => Promise<void>;
  selectDirectory: () => Promise<void>;
  run: () => Promise<void>;
  reload: () => void;
  reset: () => Promise<void>;
};
const Context = createContext<State | null>(null);
export function AutomaticBackupProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ledger } = useLedger();
  const privacy = usePrivacy();
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;
  const [preferences, setPreferences] = useState<BackupPreferences | null>(
    null,
  );
  const current = useRef<BackupPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const supported = automaticBackupSupported();
  const mounted = useRef(true);
  const reload = useCallback(() => {
    void loadBackupPreferences()
      .then((value) => {
        current.current = value;
        if (mounted.current) {
          setPreferences(value);
          setError(value.error);
        }
      })
      .catch(() => {
        if (mounted.current)
          setError('无法读取自动备份设置，请重试；账本仍可正常使用');
      });
  }, []);
  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);
  const persist = async (value: BackupPreferences) => {
    await saveBackupPreferences(value);
    current.current = value;
    if (mounted.current) setPreferences(value);
  };
  const perform = async (operation: () => Promise<void>) => {
    if (pending.current) throw new Error('自动备份正在进行，请稍后再试');
    pending.current = true;
    if (mounted.current) {
      setBusy(true);
    }
    try {
      await operation();
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : '自动备份操作失败，请重试';
      if (mounted.current) setError(message);
      throw failure;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const selectDirectory = () =>
    perform(async () => {
      const old = current.current;
      if (!old) throw new Error('请先重新读取自动备份设置');
      const selected = await pickBackupDirectory();
      if (!selected) return;
      await persist({
        ...old,
        directory: selected.directory,
        directoryName: selected.name,
        lastSuccessAt: null,
        lastFileName: null,
        lastAttemptAt: null,
        error: '',
      });
      if (mounted.current) setError('');
    });
  const reset = () =>
    perform(async () => {
      await persist(defaultBackupPreferences());
      if (mounted.current) setError('');
    });
  const configure = (days: BackupPreferences['days']) =>
    perform(async () => {
      const old = current.current;
      if (!old) throw new Error('请先重新读取自动备份设置');
      let directory = old.directory,
        directoryName = old.directoryName;
      if (days && !directory) {
        const selected = await pickBackupDirectory();
        if (!selected) return;
        directory = selected.directory;
        directoryName = selected.name;
      }
      await persist({
        ...old,
        days,
        directory,
        directoryName,
        error: '',
        lastAttemptAt: null,
      });
      if (mounted.current) setError('');
    });
  const run = async () =>
    perform(async () => {
      const old = current.current,
        snapshot = ledgerRef.current;
      if (!old || !snapshot) throw new Error('账本尚未准备好，请稍后再试');
      if (!supported)
        throw new Error('当前浏览器不支持自动文件备份，请使用导出 JSON 备份');
      const attemptedAt = new Date().toISOString();
      try {
        const result = await writeVerifiedBackup(backupFiles, old, snapshot);
        await persist({
          ...old,
          lastAttemptAt: attemptedAt,
          lastSuccessAt: result.at,
          lastFileName: result.file.name,
          error: result.warning,
        });
        if (mounted.current) setError(result.warning);
      } catch (failure) {
        const message =
          failure instanceof Error
            ? failure.message.slice(0, 500)
            : '自动备份失败';
        await persist({
          ...old,
          lastAttemptAt: attemptedAt,
          error: message,
        }).catch(() => {});
        throw failure;
      }
    });
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (
      !supported ||
      !preferences?.days ||
      !ledger ||
      privacy.phase !== 'unlocked' ||
      !privacy.active
    )
      return;
    const check = () => {
      if (current.current && !pending.current && backupDue(current.current))
        void runRef.current().catch(() => {});
    };
    // Keep initial rendering, navigation and text entry ahead of backup I/O.
    const first = setTimeout(check, 1500);
    const interval = setInterval(check, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [
    supported,
    preferences?.days,
    preferences?.directory,
    ledger !== null,
    privacy.phase,
    privacy.active,
  ]);
  return (
    <Context.Provider
      value={{
        preferences,
        busy,
        error,
        supported,
        configure,
        selectDirectory,
        run,
        reload,
        reset,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAutomaticBackup() {
  const value = useContext(Context);
  if (!value) throw new Error('AutomaticBackupProvider is required');
  return value;
}

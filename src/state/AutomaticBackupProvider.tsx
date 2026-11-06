import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  type BackupPreferences,
  backupDue,
  defaultBackupPreferences,
} from '../domain/automaticBackup';
import {
  automaticBackupSupported,
  loadBackupPreferences,
  pickBackupDirectory,
} from '../storage/automaticBackup';
import {
  changeBackupPreferences,
  executeBackup,
  resetBackupPreferences,
} from '../storage/backupJob';
import {
  backgroundBackupSupported,
  syncBackgroundBackup,
  type BackgroundStatus,
} from '../background/backgroundBackup';
import { useLedger } from './LedgerProvider';
import { usePrivacy } from './PrivacyContext';

type State = {
  preferences: BackupPreferences | null;
  busy: boolean;
  error: string;
  supported: boolean;
  backgroundSupported: boolean;
  backgroundStatus: BackgroundStatus;
  backgroundError: string;
  configure: (days: BackupPreferences['days']) => Promise<void>;
  configureBackground: (enabled: boolean) => Promise<void>;
  retryBackground: () => Promise<void>;
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
  const [preferences, setPreferences] = useState<BackupPreferences | null>(
    null,
  );
  const current = useRef<BackupPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [backgroundStatus, setBackgroundStatus] =
    useState<BackgroundStatus>('off');
  const [backgroundError, setBackgroundError] = useState('');
  const supported = automaticBackupSupported();
  const mounted = useRef(true);
  const generation = useRef(0);
  const accept = (value: BackupPreferences) => {
    current.current = value;
    if (mounted.current) {
      setPreferences(value);
      setError(value.error);
    }
  };
  const schedule = async (value: BackupPreferences) => {
    try {
      const status = await syncBackgroundBackup(value);
      if (mounted.current) {
        setBackgroundStatus(status);
        setBackgroundError('');
      }
    } catch (failure) {
      if (mounted.current) {
        setBackgroundStatus('off');
        setBackgroundError(
          failure instanceof Error
            ? failure.message
            : '后台备份尚未启用，请重试',
        );
      }
    }
  };
  const reload = useCallback(() => {
    if (pending.current) return;
    const request = ++generation.current;
    void loadBackupPreferences()
      .then((value) => {
        if (
          pending.current ||
          request !== generation.current ||
          !mounted.current
        )
          return;
        accept(value);
        void schedule(value);
      })
      .catch(() => {
        if (mounted.current && request === generation.current)
          setError('无法读取自动备份设置，请重试；账本仍可正常使用');
      });
  }, []);
  useEffect(() => {
    mounted.current = true;
    reload();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => {
      mounted.current = false;
      listener.remove();
    };
  }, [reload]);
  const perform = async (operation: () => Promise<void>) => {
    if (pending.current) throw new Error('自动备份正在进行，请稍后再试');
    pending.current = true;
    generation.current++;
    if (mounted.current) setBusy(true);
    try {
      await operation();
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : '自动备份操作失败，请重试',
        );
      throw failure;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const change = async (
    operation: (old: BackupPreferences) => BackupPreferences,
  ) => {
    const next = await changeBackupPreferences(operation);
    accept(next);
    await schedule(next);
  };
  const selectDirectory = () =>
    perform(async () => {
      if (!current.current) throw new Error('请先重新读取自动备份设置');
      const selected = await pickBackupDirectory();
      if (!selected) return;
      await change((old) => ({
        ...old,
        directory: selected.directory,
        directoryName: selected.name,
        lastSuccessAt: null,
        lastBackgroundSuccessAt: null,
        lastFileName: null,
        lastAttemptAt: null,
        error: '',
      }));
    });
  const reset = () =>
    perform(async () => {
      const next = await resetBackupPreferences(defaultBackupPreferences());
      accept(next);
      await schedule(next);
    });
  const configure = (days: BackupPreferences['days']) =>
    perform(async () => {
      const old = current.current;
      if (!old) throw new Error('请先重新读取自动备份设置');
      const selected =
        days && !old.directory ? await pickBackupDirectory() : null;
      if (days && !old.directory && !selected) return;
      await change((latest) => ({
        ...latest,
        days,
        ...(days ? {} : { background: false }),
        ...(selected
          ? { directory: selected.directory, directoryName: selected.name }
          : {}),
        error: '',
        lastAttemptAt: null,
      }));
    });
  const configureBackground = (background: boolean) =>
    perform(async () => {
      if (!backgroundBackupSupported) throw new Error('当前平台使用前台备份');
      await change((old) => {
        if (background && (!old.days || !old.directory))
          throw new Error('请先选择备份目录和频率');
        return {
          ...old,
          background,
          lastBackgroundSuccessAt:
            background && !old.background ? null : old.lastBackgroundSuccessAt,
        };
      });
    });
  const retryBackground = () =>
    perform(async () => {
      const latest = await loadBackupPreferences();
      accept(latest);
      await schedule(latest);
    });
  const run = (scheduled = false) =>
    perform(async () => {
      if (!supported)
        throw new Error('当前浏览器不支持自动文件备份，请使用导出 JSON 备份');
      const next = await executeBackup({ scheduled });
      accept(next);
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
        void runRef.current(true).catch(() => {});
    };
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
        backgroundSupported: backgroundBackupSupported,
        backgroundStatus,
        backgroundError,
        configure,
        configureBackground,
        retryBackground,
        selectDirectory,
        run: () => run(),
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

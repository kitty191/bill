import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  defaultPreferences,
  validatePreferences,
  type DevicePreferences,
} from '../domain/privacy';
import {
  authenticateDevice,
  loadPreferences,
  savePreferences,
  supportsAppLock,
} from '../storage/devicePreferences';
import {
  AmountVisibilityContext,
  PrivacyContext,
  type PrivacyState,
} from './PrivacyContext';

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const current = useRef(preferences);
  const pending = useRef(false);
  const authenticating = useRef(false);
  const backgroundedDuringAuthentication = useRef(false);
  const [phase, setPhase] = useState<PrivacyState['phase']>('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [lockEpoch, setLockEpoch] = useState(0);
  const [now, setNow] = useState(Date.now);
  const reload = useCallback(() => {
    setPhase('loading');
    setError('');
    void loadPreferences()
      .then((value) => {
        current.current = value;
        setPreferences(value);
        setPhase(value.appLockEnabled ? 'locked' : 'unlocked');
        setLockEpoch((value) => value + 1);
      })
      .catch(() => {
        setError('无法读取本机隐私设置，请重新读取');
        setPhase('error');
      });
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state === 'active') setNow(Date.now());
      if (state === 'background' && authenticating.current)
        backgroundedDuringAuthentication.current = true;
      if (
        state === 'background' &&
        current.current.appLockEnabled &&
        !authenticating.current
      ) {
        setPhase('locked');
        setError('');
        setLockEpoch((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, []);
  const save = useCallback(
    async (
      change: (value: DevicePreferences) => DevicePreferences,
      verified = false,
    ) => {
      if (pending.current) throw new Error('设置正在保存，请稍后重试');
      pending.current = true;
      setSaving(true);
      try {
        const next = validatePreferences(change(current.current));
        if (next.appLockEnabled !== current.current.appLockEnabled && !verified)
          throw new Error('应用锁设置需要系统身份验证');
        await savePreferences(next);
        current.current = next;
        setPreferences(next);
        setNow(Date.now());
        if (next.appLockEnabled && AppState.currentState === 'background') {
          setPhase('locked');
          setLockEpoch((value) => value + 1);
        }
      } finally {
        pending.current = false;
        setSaving(false);
      }
    },
    [],
  );
  const update = useCallback(
    (change: (value: DevicePreferences) => DevicePreferences) => save(change),
    [save],
  );
  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    setAuthBusy(true);
    setError('');
    try {
      if (await authenticateDevice()) {
        if (AppState.currentState !== 'background') setPhase('unlocked');
      } else setError('验证已取消');
    } catch (error) {
      setError(error instanceof Error ? error.message : '验证失败，请重试');
    } finally {
      authenticating.current = false;
      setAuthBusy(false);
    }
  }, []);
  const setAppLock = useCallback(
    async (enabled: boolean) => {
      if (!supportsAppLock) throw new Error('应用锁仅在手机独立安装版可用');
      if (authenticating.current) throw new Error('正在验证身份');
      authenticating.current = true;
      backgroundedDuringAuthentication.current = false;
      setAuthBusy(true);
      let verified = false;
      try {
        if (!(await authenticateDevice(enabled)))
          throw new Error('验证已取消，设置保持原状');
        await save((value) => ({ ...value, appLockEnabled: enabled }), true);
        verified = true;
      } finally {
        authenticating.current = false;
        setAuthBusy(false);
        if (
          current.current.appLockEnabled &&
          (AppState.currentState === 'background' ||
            (backgroundedDuringAuthentication.current && !verified))
        ) {
          setPhase('locked');
          setLockEpoch((value) => value + 1);
        }
      }
    },
    [save],
  );
  const markExported = useCallback(
    () =>
      update((value) => ({
        ...value,
        lastExportAt: new Date().toISOString(),
        snoozeUntil: null,
      })),
    [update],
  );
  const snoozeReminder = useCallback(
    () =>
      update((value) => ({
        ...value,
        snoozeUntil: new Date(Date.now() + 86_400_000).toISOString(),
      })),
    [update],
  );
  const value = useMemo(
    () => ({
      preferences,
      phase,
      error,
      active,
      authBusy,
      saving,
      lockEpoch,
      now,
      supportsAppLock,
      reload,
      unlock,
      update,
      setAppLock,
      markExported,
      snoozeReminder,
    }),
    [
      preferences,
      phase,
      error,
      active,
      authBusy,
      saving,
      lockEpoch,
      now,
      reload,
      unlock,
      update,
      setAppLock,
      markExported,
      snoozeReminder,
    ],
  );
  return (
    <PrivacyContext.Provider value={value}>
      <AmountVisibilityContext.Provider value={preferences.hideAmounts}>
        {children}
      </AmountVisibilityContext.Provider>
    </PrivacyContext.Provider>
  );
}

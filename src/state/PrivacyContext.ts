import { createContext, useCallback, useContext } from 'react';
import { money } from '../domain/ledger';
import type { DevicePreferences } from '../domain/privacy';

export type PrivacyState = {
  preferences: DevicePreferences;
  phase: 'loading' | 'error' | 'locked' | 'unlocked';
  error: string;
  active: boolean;
  authBusy: boolean;
  saving: boolean;
  lockEpoch: number;
  now: number;
  supportsAppLock: boolean;
  reload: () => void;
  unlock: () => Promise<void>;
  update: (
    change: (current: DevicePreferences) => DevicePreferences,
  ) => Promise<void>;
  setAppLock: (enabled: boolean) => Promise<void>;
  markExported: () => Promise<void>;
  snoozeReminder: () => Promise<void>;
};
export const PrivacyContext = createContext<PrivacyState | null>(null);
export const AmountVisibilityContext = createContext(false);
export const useAmountsHidden = () => useContext(AmountVisibilityContext);
export function usePrivacy() {
  const state = useContext(PrivacyContext);
  if (!state) throw new Error('PrivacyProvider is required');
  return state;
}
export function useMoney() {
  const hidden = useAmountsHidden();
  return useCallback(
    (amount: number, decimals = true) =>
      hidden ? '••••' : money(amount, decimals),
    [hidden],
  );
}

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDate } from '../domain/ledger';

/** Follow local midnight, including suspended timers and device clock changes. */
export function useLocalDate(): string {
  const [today, setToday] = useState(() => localDate());
  useEffect(() => {
    let observed = today;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      const date = localDate(now);
      if (date !== observed) {
        observed = date;
        setToday(date);
      }
      if (AppState.currentState === 'background') return;
      const midnight = new Date(now);
      // Calendar arithmetic follows local midnight even on 23 / 25 hour days.
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(
        refresh,
        Math.min(60_000, Math.max(1, midnight.getTime() - now.getTime())),
      );
    };
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return today;
}

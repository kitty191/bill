import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep native switch feedback immediate while serializing durable changes.
 * Only this control is optimistic; the ledger still commits after storage. */
export function useSavedToggle(
  value: boolean,
  save: (value: boolean) => Promise<void>,
) {
  const [displayed, setDisplayed] = useState(value);
  const [error, setError] = useState('');
  const desired = useRef(value);
  const confirmed = useRef(value);
  const running = useRef(false);
  const mounted = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    confirmed.current = value;
    if (!running.current) {
      desired.current = value;
      setDisplayed(value);
    }
  }, [value]);
  const onValueChange = useCallback((next: boolean) => {
    desired.current = next;
    setDisplayed(next);
    setError('');
    if (running.current) return;
    running.current = true;
    // Let the urgent native control update commit before validation/serialization.
    setTimeout(() => {
      void (async () => {
        try {
          while (desired.current !== confirmed.current) {
            const target = desired.current;
            try {
              await saveRef.current(target);
              confirmed.current = target;
            } catch (failure) {
              // Do not overwrite a newer tap with the result of an older request.
              if (desired.current === target) {
                desired.current = confirmed.current;
                if (mounted.current) setDisplayed(confirmed.current);
              }
              if (mounted.current)
                setError(
                  failure instanceof Error
                    ? failure.message
                    : '设置保存失败，请重试',
                );
            }
          }
        } finally {
          running.current = false;
        }
      })();
    }, 0);
  }, []);
  return { value: displayed, onValueChange, error };
}

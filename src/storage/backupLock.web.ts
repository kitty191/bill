let running = false;
export async function withBackupLock<T>(
  operation: (renew: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const execute = async () => {
    if (running) throw new Error('自动备份正在进行，请稍后再试');
    running = true;
    try {
      return await operation(async () => {});
    } finally {
      running = false;
    }
  };
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(
      'qingzhang-automatic-backup',
      { ifAvailable: true },
      (lock) => {
        if (!lock) throw new Error('自动备份正在进行，请稍后再试');
        return execute();
      },
    );
  return execute();
}

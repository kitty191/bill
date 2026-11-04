import * as Haptics from 'expo-haptics';

export const motion = {
  press: 85,
  fade: 160,
  sheet: 230,
  dismiss: 180,
  spring: { damping: 28, stiffness: 340, mass: 0.85 },
};

export function feedback(kind: 'selection' | 'light' | 'success' | 'warning') {
  if (typeof document !== 'undefined') return;
  try {
    const task =
      kind === 'selection'
        ? Haptics.selectionAsync()
        : kind === 'light'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : Haptics.notificationAsync(
              kind === 'success'
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Warning,
            );
    void task.catch(() => {});
  } catch {
    // A missing device capability must never block an action or a saved entry.
  }
}

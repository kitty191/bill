let previous: (() => void) | undefined;
/** A sheet mounted beneath an already-held finger must not receive the
 * compatibility click from that gesture. A fresh pointer or keyboard action
 * is immediately usable; there is no arbitrary activation delay. */
export function guardLongPressRelease() {
  previous?.();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    document.removeEventListener('click', click, true);
    document.removeEventListener('pointerdown', cleanup, true);
    document.removeEventListener('keydown', cleanup, true);
    document.removeEventListener('pointerup', released, true);
    document.removeEventListener('pointercancel', released, true);
    if (previous === cleanup) previous = undefined;
  };
  const click = (event: MouseEvent) => {
    // Assistive technology and keyboard activation use a zero-detail click.
    if (event.detail !== 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    cleanup();
  };
  const released = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(cleanup, 500);
  };
  document.addEventListener('click', click, true);
  document.addEventListener('pointerdown', cleanup, true);
  document.addEventListener('keydown', cleanup, true);
  document.addEventListener('pointerup', released, true);
  document.addEventListener('pointercancel', released, true);
  previous = cleanup;
}

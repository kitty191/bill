/** Logical tabs advance rightward; their physical pages sit to the left.
 * A rightward finger drag decreases the ordinary positive scroll offset. */
export function pagerOffset(
  index: number,
  count: number,
  width: number,
): number {
  'worklet';
  return (count - 1 - index) * width;
}

export function pagerProgress(
  offset: number,
  count: number,
  width: number,
): number {
  'worklet';
  if (!width) return 0;
  return Math.max(0, Math.min(count - 1, count - 1 - offset / width));
}

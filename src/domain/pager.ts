/** Pages have the same left-to-right order as their dock tabs. */
export function pagerOffset(
  index: number,
  count: number,
  width: number,
): number {
  'worklet';
  return Math.max(0, Math.min(count - 1, index)) * width;
}

export function pagerProgress(
  offset: number,
  count: number,
  width: number,
): number {
  'worklet';
  if (!width) return 0;
  return Math.max(0, Math.min(count - 1, offset / width));
}

export function settledPagerIndex(value: number): number | null {
  const nearest = Math.round(value);
  return Number.isFinite(value) && Math.abs(value - nearest) < 0.01
    ? nearest
    : null;
}

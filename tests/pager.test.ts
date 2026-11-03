import { describe, expect, it } from 'vitest';
import {
  pagerOffset,
  pagerProgress,
  settledPagerIndex,
} from '../src/domain/pager';

describe('physical page order and logical dock order', () => {
  it('places Home, Entries and Stats left to right like the dock', () => {
    expect([0, 1, 2].map((index) => pagerOffset(index, 3, 390))).toEqual([
      0, 390, 780,
    ]);
  });
  it('advances the dock as a leftward finger drag reveals the page to the right', () => {
    expect(pagerProgress(0, 3, 390)).toBe(0);
    expect(pagerProgress(195, 3, 390)).toBe(0.5);
    expect(pagerProgress(390, 3, 390)).toBe(1);
    expect(pagerProgress(780, 3, 390)).toBe(2);
    for (const width of [320, 390, 430])
      for (const index of [0, 1, 2])
        expect(pagerProgress(pagerOffset(index, 3, width), 3, width)).toBe(
          index,
        );
  });
  it('clamps native bounce at each end and handles initial zero width', () => {
    expect(pagerProgress(850, 3, 390)).toBe(2);
    expect(pagerProgress(-40, 3, 390)).toBe(0);
    expect(pagerProgress(0, 3, 0)).toBe(0);
    expect(pagerProgress(0, 1, 390)).toBe(0);
  });
  it('commits pages only at an actual boundary, never from an in-flight position', () => {
    expect(settledPagerIndex(0)).toBe(0);
    expect(settledPagerIndex(0.9995)).toBe(1);
    expect(settledPagerIndex(2)).toBe(2);
    expect(settledPagerIndex(0.4)).toBeNull();
    expect(settledPagerIndex(1.8)).toBeNull();
    expect(settledPagerIndex(NaN)).toBeNull();
  });
});

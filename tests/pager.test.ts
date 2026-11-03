import { describe, expect, it } from 'vitest';
import { pagerOffset, pagerProgress } from '../src/domain/pager';

describe('physical page order and logical dock order', () => {
  it('starts Home at the right edge, with Entries and Stats physically to its left', () => {
    expect([0, 1, 2].map((index) => pagerOffset(index, 3, 390))).toEqual([
      780, 390, 0,
    ]);
  });
  it('advances the dock when a rightward finger drag reduces the native scroll offset', () => {
    expect(pagerProgress(780, 3, 390)).toBe(0);
    expect(pagerProgress(585, 3, 390)).toBe(0.5);
    expect(pagerProgress(390, 3, 390)).toBe(1);
    expect(pagerProgress(0, 3, 390)).toBe(2);
    for (const width of [320, 390, 430])
      for (const index of [0, 1, 2])
        expect(pagerProgress(pagerOffset(index, 3, width), 3, width)).toBe(
          index,
        );
  });
  it('clamps native bounce at each end and handles initial zero width', () => {
    expect(pagerProgress(850, 3, 390)).toBe(0);
    expect(pagerProgress(-40, 3, 390)).toBe(2);
    expect(pagerProgress(0, 3, 0)).toBe(0);
    expect(pagerProgress(0, 1, 390)).toBe(0);
  });
});

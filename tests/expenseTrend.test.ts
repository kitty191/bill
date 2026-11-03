import { describe, expect, it } from 'vitest';
import { type Entry } from '../src/domain/ledger';
import {
  dailyExpenseValues,
  trendAxisLabel,
  trendGeometry,
} from '../src/domain/expenseTrend';

const base: Entry = {
  id: 'one',
  kind: 'expense',
  amount: 1250,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-11-01',
  note: '',
  createdAt: '2026-11-01T00:00:00Z',
};

describe('daily expense series', () => {
  it('aggregates expenses by date and preserves real zero days', () => {
    const values = dailyExpenseValues(
      [
        base,
        { ...base, id: 'two', amount: 750 },
        { ...base, id: 'three', date: '2026-11-03', amount: 3900 },
        {
          ...base,
          id: 'income',
          kind: 'income',
          categoryId: 'salary',
          amount: 80000,
        },
        {
          ...base,
          id: 'transfer',
          kind: 'transfer',
          categoryId: 'transfer',
          toAccountId: 'alipay',
        },
        { ...base, id: 'outside', date: '2026-10-01' },
      ],
      '2026-11',
      '2026-11-04',
    );
    expect(values).toEqual([2000, 0, 3900, 0]);
  });
  it('does not draw unobserved future days as a decline', () => {
    expect(dailyExpenseValues([base], '2026-11', '2026-11-03')).toHaveLength(3);
    expect(
      dailyExpenseValues(
        [{ ...base, date: '2026-11-07' }],
        '2026-11',
        '2026-11-03',
      ),
    ).toHaveLength(7);
    expect(dailyExpenseValues([], '2026-12', '2026-11-03')).toEqual([0]);
  });
  it('uses the complete calendar for past months including leap February', () => {
    expect(dailyExpenseValues([], '2024-02', '2026-11-03')).toHaveLength(29);
    expect(dailyExpenseValues([], '2026-02', '2026-11-03')).toHaveLength(28);
    expect(dailyExpenseValues([], '2026-10', '2026-11-03')).toHaveLength(31);
  });
});

describe('expense line geometry', () => {
  it('plots exact zero baselines, chronological peaks and bounded segments', () => {
    const chart = trendGeometry([1000, 0, 3500, 0], 300, 180);
    expect(chart.maximum).toBe(5000);
    expect(chart.points.map((p) => p.amount)).toEqual([1000, 0, 3500, 0]);
    expect(chart.points[1]!.y).toBe(chart.baseline);
    expect(chart.points[2]!.y).toBeLessThan(chart.points[0]!.y);
    expect(
      chart.points.every((p) => p.y >= chart.top && p.y <= chart.baseline),
    ).toBe(true);
    expect(chart.line.match(/L/g)).toHaveLength(3);
    expect(chart.area.endsWith('Z')).toBe(true);
  });
  it('renders a single day and empty months without NaN or invented values', () => {
    const single = trendGeometry([2900], 230, 180);
    expect(single.points[0]!.x).toBe((single.left + single.right) / 2);
    const empty = trendGeometry(Array(31).fill(0), 230, 180);
    expect(empty.points.every((p) => p.y === empty.baseline)).toBe(true);
    expect(empty.line).not.toMatch(/NaN|Infinity/);
    expect(empty.peak).toBe(0);
  });
  it('formats large axis values without widening the chart', () => {
    expect(trendAxisLabel(0)).toBe('0');
    expect(trendAxisLabel(1250)).toBe('12.5');
    expect(trendAxisLabel(120000)).toBe('1.2千');
    expect(trendAxisLabel(2500000)).toBe('2.5万');
    expect(trendAxisLabel(10000000000)).toBe('1亿');
  });
});

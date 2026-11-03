import { type Entry, localDate, refundAmounts } from './ledger';

export function dailyExpenseValues(
  entries: Entry[],
  month: string,
  today = localDate(),
): number[] {
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const values = Array<number>(days).fill(0);
  let lastRecorded = 1;
  const refunds = refundAmounts(entries);
  for (const entry of entries) {
    if (entry.kind !== 'expense' || !entry.date.startsWith(month)) continue;
    const day = Number(entry.date.slice(8));
    values[day - 1]! += entry.amount - (refunds.get(entry.id) ?? 0);
    lastRecorded = Math.max(lastRecorded, day);
  }
  // Do not connect unobserved future days as if they were zero-spend days.
  const currentMonth = today.slice(0, 7);
  const visibleDays =
    month < currentMonth
      ? days
      : Math.max(
          lastRecorded,
          month === currentMonth ? Number(today.slice(8)) : 1,
        );
  return values.slice(0, visibleDays);
}

export function trendGeometry(values: number[], width: number, height: number) {
  const peak = Math.max(0, ...values);
  const power = peak ? 10 ** Math.floor(Math.log10(peak)) : 1;
  const fraction = peak / power;
  const maximum = peak
    ? (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
    : 100;
  const left = 44,
    right = Math.max(left + 1, width - 10),
    top = 12,
    baseline = height - 25;
  const points = values.map((amount, i) => ({
    day: i + 1,
    amount,
    x:
      values.length === 1
        ? (left + right) / 2
        : left + (i / (values.length - 1)) * (right - left),
    y: baseline - (amount / maximum) * (baseline - top),
  }));
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  const first = points[0],
    last = points.at(-1);
  const area =
    first && last
      ? `${line} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`
      : '';
  return { points, line, area, left, right, top, baseline, peak, maximum };
}

export function trendAxisLabel(cents: number): string {
  const yuan = cents / 100;
  if (yuan >= 100_000_000)
    return `${Number((yuan / 100_000_000).toFixed(1))}亿`;
  if (yuan >= 10_000) return `${Number((yuan / 10_000).toFixed(1))}万`;
  if (yuan >= 1_000) return `${Number((yuan / 1_000).toFixed(1))}千`;
  return String(Number(yuan.toFixed(2)));
}

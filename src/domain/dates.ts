import { localDate, validDate } from './ledger';

export function validMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && validDate(`${month}-01`);
}
export function pickerYear(value: string): number | null {
  const year = Number(value);
  return /^\d{4}$/.test(value) && year >= 1900 && year <= 2200 ? year : null;
}
export function monthOffset(from: string, to: string): number {
  if (!validMonth(from) || !validMonth(to)) throw new Error('月份无效');
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5)) -
    Number(from.slice(5))
  );
}
export function monthRange(month: string) {
  if (!validMonth(month)) throw new Error('月份无效');
  return {
    startDate: `${month}-01`,
    endDate: localDate(
      new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
    ),
  };
}
export function shiftDay(date: string, offset: number) {
  const value = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8)) + offset,
  );
  return localDate(value);
}
export function calendarDays(month: string): (string | null)[] {
  const range = monthRange(month);
  const offset =
    (new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)) - 1,
      1,
    ).getDay() +
      6) %
    7;
  const days = Number(range.endDate.slice(8));
  return Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, index) =>
      index < offset || index >= offset + days
        ? null
        : `${month}-${String(index - offset + 1).padStart(2, '0')}`,
  );
}

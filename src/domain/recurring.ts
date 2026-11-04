import {
  type Entry,
  type Ledger,
  type RecurringBill,
  localDate,
  upsertEntry,
  validDate,
  validateLedger,
} from './ledger';
import { shiftDay } from './dates';

export const cadenceLabel = { weekly: '每周', monthly: '每月', yearly: '每年' };
export function nextOccurrence(bill: RecurringBill): string | null {
  const [year, month, day] = bill.nextDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const [, anchorMonth, anchorDay] = bill.anchorDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  let result: string;
  if (bill.cadence === 'weekly') result = shiftDay(bill.nextDate, 7);
  else {
    const y =
      bill.cadence === 'yearly' ? year + 1 : year + (month === 12 ? 1 : 0);
    const m =
      bill.cadence === 'yearly' ? anchorMonth : month === 12 ? 1 : month + 1;
    const last = new Date(y, m, 0).getDate();
    result = localDate(new Date(y, m - 1, Math.min(anchorDay, last)));
  }
  return validDate(result) ? result : null;
}
export function dueRecurring(ledger: Ledger, today: string) {
  return ledger.recurringEnabled
    ? ledger.recurringBills
        .filter((bill) => bill.enabled && bill.nextDate <= today)
        .sort(
          (a, b) =>
            a.nextDate.localeCompare(b.nextDate) || a.id.localeCompare(b.id),
        )
    : [];
}
function pendingBill(ledger: Ledger, id: string, date: string, today: string) {
  const bill = ledger.recurringBills.find((item) => item.id === id);
  if (!ledger.recurringEnabled || !bill?.enabled)
    throw new Error('周期提醒已关闭，请在设置中检查');
  if (bill.nextDate !== date || date > today)
    throw new Error('周期账期已变化，请关闭后重新打开');
  return bill;
}
export function advanceRecurring(
  ledger: Ledger,
  id: string,
  date: string,
  today = localDate(),
): Ledger {
  const bill = pendingBill(ledger, id, date, today);
  const next = nextOccurrence(bill);
  return validateLedger({
    ...ledger,
    recurringBills: ledger.recurringBills.map((item) =>
      item.id === id
        ? { ...item, nextDate: next ?? item.nextDate, enabled: next !== null }
        : item,
    ),
  });
}
export function confirmRecurring(
  ledger: Ledger,
  id: string,
  date: string,
  entry: Entry,
  today = localDate(),
): Ledger {
  const bill = pendingBill(ledger, id, date, today);
  if (
    ledger.entries.some(
      (item) => item.recurringId === id && item.recurringDate === date,
    )
  )
    throw new Error('本期已经记账，请勿重复确认');
  if (entry.kind !== bill.kind) throw new Error('周期账单收支类型不一致');
  const next = upsertEntry(
    ledger,
    { ...entry, recurringId: id, recurringDate: date },
    true,
  );
  return advanceRecurring(next, id, date, today);
}

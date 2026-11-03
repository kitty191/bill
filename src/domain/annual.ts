import { type Ledger, totals, categoryTotals, localDate } from './ledger';

export function annualSummary(
  ledger: Ledger,
  year: number,
  today = localDate(),
) {
  const prefix = String(year);
  const entries = ledger.entries.filter((e) => e.date.slice(0, 4) === prefix);
  const thisYear = Number(today.slice(0, 4));
  const lastRecorded = Math.max(
    1,
    ...entries.map((e) => Number(e.date.slice(5, 7))),
  );
  const observedMonths =
    year < thisYear
      ? 12
      : Math.max(
          lastRecorded,
          year === thisYear ? Number(today.slice(5, 7)) : 1,
        );
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const result = totals(
      entries.filter((e) => e.date.startsWith(month)),
      ledger.entries,
    );
    return { month: index + 1, ...result, net: result.income - result.expense };
  });
  const current = totals(entries, ledger.entries);
  const priorEntries = ledger.entries.filter(
    (e) =>
      Number(e.date.slice(0, 4)) === year - 1 &&
      Number(e.date.slice(5, 7)) <= observedMonths,
  );
  const prior = totals(priorEntries, ledger.entries);
  const currentCategories = new Map(
    categoryTotals(entries, ledger.categories, ledger.entries).map((c) => [
      c.id,
      c.total,
    ]),
  );
  const priorCategories = new Map(
    categoryTotals(priorEntries, ledger.categories, ledger.entries).map((c) => [
      c.id,
      c.total,
    ]),
  );
  const categories = ledger.categories
    .filter((c) => c.kind === 'expense')
    .map((c) => ({
      ...c,
      total: currentCategories.get(c.id) ?? 0,
      previous: priorCategories.get(c.id) ?? 0,
    }))
    .filter((c) => c.total > 0 || c.previous > 0)
    .sort((a, b) => b.total - a.total || b.previous - a.previous);
  return {
    year,
    observedMonths,
    monthly,
    ...current,
    net: current.income - current.expense,
    averageExpense: Math.round(current.expense / observedMonths),
    previousExpense: prior.expense,
    categories,
  };
}

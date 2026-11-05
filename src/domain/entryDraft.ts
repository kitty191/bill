import {
  type Entry,
  type EntryKind,
  type Ledger,
  id,
  localDate,
} from './ledger';
import type { CalculatorDraft } from './calculator';

export type EditorIntent = {
  entry?: Entry;
  repeatSource?: Entry;
  refundOf?: Entry;
  templateId?: string;
  recurringId?: string;
  recurringDate?: string;
};
export type EntryDraft = {
  version: 1;
  id: string;
  recordId: string;
  context: {
    entryId?: string;
    baseline?: string;
    originalEntryId?: string;
    recurringId?: string;
    recurringDate?: string;
  };
  fields: {
    kind: EntryKind;
    calculator: CalculatorDraft;
    categoryId: string;
    accountId: string;
    toAccountId: string;
    date: string;
    note: string;
    saveTemplate: boolean;
    templateName: string;
  };
};
export function draftIdentity(
  intent: EditorIntent,
  ledger: Ledger,
): Omit<EntryDraft, 'fields'> {
  const recurring = ledger.recurringBills.find(
    (item) => item.id === intent.recurringId,
  );
  return {
    version: 1,
    id: `draft-${id()}`,
    recordId: intent.entry?.id ?? id(),
    context: intent.entry
      ? { entryId: intent.entry.id, baseline: JSON.stringify(intent.entry) }
      : intent.recurringId
        ? {
            recurringId: intent.recurringId,
            recurringDate: intent.recurringDate,
            baseline: JSON.stringify(recurring),
          }
        : intent.refundOf || intent.repeatSource?.kind === 'refund'
          ? {
              originalEntryId:
                intent.refundOf?.id ?? intent.repeatSource?.originalEntryId,
            }
          : {},
  };
}
export function parseEntryDraft(raw: string): EntryDraft {
  const invalid = () => {
    throw new Error('未完成的记账草稿无法读取，请重新记账');
  };
  if (raw.length > 12000) return invalid();
  let value: EntryDraft;
  try {
    value = JSON.parse(raw);
  } catch {
    return invalid();
  }
  if (!value || value.version !== 1 || !value.context || !value.fields)
    return invalid();
  const bounded = (v: unknown, max: number) =>
    typeof v === 'string' && v.length <= max;
  if (
    !bounded(value.id, 100) ||
    !value.id ||
    !bounded(value.recordId, 100) ||
    !value.recordId
  )
    return invalid();
  const f = value.fields,
    c = value.context;
  if (
    !['expense', 'income', 'transfer', 'refund'].includes(f.kind) ||
    !f.calculator ||
    !bounded(f.calculator.expression, 120) ||
    typeof f.calculator.fresh !== 'boolean' ||
    !bounded(f.categoryId, 100) ||
    !bounded(f.accountId, 100) ||
    !bounded(f.toAccountId, 100) ||
    !bounded(f.date, 10) ||
    !bounded(f.note, 120) ||
    typeof f.saveTemplate !== 'boolean' ||
    !bounded(f.templateName, 20)
  )
    return invalid();
  for (const key of [
    'entryId',
    'originalEntryId',
    'recurringId',
    'recurringDate',
  ] as const)
    if (c[key] !== undefined && !bounded(c[key], 100)) return invalid();
  if (c.baseline !== undefined && !bounded(c.baseline, 6000)) return invalid();
  // Errors are derived again by the calculator; persisted text never supplies UI errors.
  return {
    ...value,
    fields: {
      ...f,
      calculator: {
        expression: f.calculator.expression,
        fresh: f.calculator.fresh,
        error: '',
      },
    },
  };
}
export function resumeEntryDraft(
  draft: EntryDraft,
  ledger: Ledger,
): EditorIntent {
  const stale = () => {
    throw new Error('草稿对应的账单或设置已变化，请重新记账');
  };
  const c = draft.context,
    f = draft.fields;
  if (
    !ledger.accounts.some((a) => a.id === f.accountId) ||
    (f.kind === 'transfer' &&
      !ledger.accounts.some((a) => a.id === f.toAccountId)) ||
    (f.kind !== 'transfer' &&
      !ledger.categories.some(
        (a) =>
          a.id === f.categoryId &&
          a.kind === (f.kind === 'income' ? 'income' : 'expense'),
      ))
  )
    return stale();
  if (c.entryId) {
    const entry = ledger.entries.find((e) => e.id === c.entryId);
    if (!entry || JSON.stringify(entry) !== c.baseline) return stale();
    return { entry };
  }
  // Stable new IDs prevent a stale web draft from booking twice after a successful write.
  if (ledger.entries.some((e) => e.id === draft.recordId)) return stale();
  if (c.recurringId) {
    const bill = ledger.recurringBills.find((b) => b.id === c.recurringId);
    if (
      !ledger.recurringEnabled ||
      !bill?.enabled ||
      JSON.stringify(bill) !== c.baseline ||
      bill.nextDate !== c.recurringDate ||
      bill.nextDate > localDate()
    )
      return stale();
    return { recurringId: bill.id, recurringDate: c.recurringDate };
  }
  if (f.kind === 'refund') {
    const refundOf = ledger.entries.find(
      (e) => e.id === c.originalEntryId && e.kind === 'expense',
    );
    if (!refundOf) return stale();
    return { refundOf };
  }
  return {};
}

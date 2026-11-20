import Papa from 'papaparse';
import {
  csvColumns,
  parseAmount,
  validDate,
  type Entry,
  type Ledger,
} from './ledger';

type Candidate = Omit<Entry, 'id' | 'createdAt'>;
export const MAX_CSV_BYTES = 5_000_000;

function entryKey(entry: Candidate) {
  return JSON.stringify([
    entry.date,
    entry.kind,
    entry.categoryId,
    entry.amount,
    entry.accountId,
    entry.toAccountId ?? '',
    entry.note,
  ]);
}

export function previewCsv(text: string, ledger: Ledger) {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    delimiter: ',',
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length)
    throw new Error('CSV 格式无效，请检查双引号及分隔符');
  const [header, ...rows] = parsed.data;
  if (
    header?.length !== csvColumns.length ||
    csvColumns.some((column, index) => header[index] !== column)
  )
    throw new Error('列名不匹配，请使用清账 CSV 模板');
  if (rows.length > 50000) throw new Error('每个文件最多 50,000 条账单');
  const findUnique = <T extends { id: string }>(
    items: T[],
    label: (item: T) => string,
    value: string,
  ) => {
    const found = items.filter((item) => label(item) === value.trim());
    return found.length === 1 ? found[0]!.id : undefined;
  };
  const account = (name: string) =>
    findUnique(ledger.accounts, (item) => item.name, name);
  const seen = new Set(ledger.entries.map(entryKey));
  const candidates: Candidate[] = [];
  const issues: { record: number; message: string; duplicate?: boolean }[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      if (row.length !== csvColumns.length) throw new Error('列数不正确');
      const [date, type, label, amount, from, target, note, original] = row as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      const kind =
        type === '支出'
          ? 'expense'
          : type === '收入'
            ? 'income'
            : type === '转账'
              ? 'transfer'
              : null;
      if (!kind || original.trim())
        throw new Error('模板支持收入、支出和转账，关联退款请手动记录');
      if (!validDate(date.trim())) throw new Error('日期须为 YYYY-MM-DD');
      if (note.trim().length > 120) throw new Error('备注最多 120 字');
      const accountId = account(from);
      if (!accountId) throw new Error('账户不存在或名称不唯一');
      const toAccountId = kind === 'transfer' ? account(target) : undefined;
      if (
        kind === 'transfer'
          ? !toAccountId || toAccountId === accountId
          : !!target.trim()
      )
        throw new Error('转入账户不适用、无效或与转出账户相同');
      const categoryId =
        kind === 'transfer'
          ? 'transfer'
          : findUnique(
              ledger.categories.filter((category) => category.kind === kind),
              (category) => category.label,
              label,
            );
      if (!categoryId) throw new Error('分类不存在或名称不唯一');
      const candidate: Candidate = {
        date: date.trim(),
        kind,
        categoryId,
        amount: parseAmount(amount),
        accountId,
        note: note.trim(),
        ...(toAccountId ? { toAccountId } : {}),
      };
      const key = entryKey(candidate);
      if (seen.has(key))
        issues.push({
          record: index + 1,
          message: '疑似重复',
          duplicate: true,
        });
      else {
        seen.add(key);
        candidates.push(candidate);
      }
    } catch (error) {
      issues.push({
        record: index + 1,
        message: error instanceof Error ? error.message : '记录无效',
      });
    }
  }
  if (ledger.entries.length + candidates.length > 50000)
    throw new Error('导入后将超过 50,000 条账单');
  return { candidates, issues };
}

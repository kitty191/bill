import { expect, test, vi } from 'vitest';
import { changeEntryCategories } from '../src/domain/batchCategories';
import {
  checkLatestBackup,
  defaultBackupPreferences,
} from '../src/domain/automaticBackup';
import { shortcutKind } from '../src/domain/entryShortcut';
import { previewCsv } from '../src/domain/importCsv';
import {
  csv,
  emptyLedger,
  type Entry,
  validateLedger,
} from '../src/domain/ledger';

const entry: Entry = {
  id: 'expense',
  kind: 'expense',
  date: '2026-11-20',
  amount: 1234,
  categoryId: 'food',
  accountId: 'wechat',
  note: '午餐',
  createdAt: '2026-11-20T04:00:00Z',
};

test('batch changes propagate to the original expense’s refunds and reject stale selections', () => {
  const refund: Entry = {
    ...entry,
    id: 'refund',
    kind: 'refund',
    amount: 100,
    originalEntryId: entry.id,
  };
  const ledger = validateLedger({ ...emptyLedger(), entries: [entry, refund] });
  const changed = validateLedger(
    changeEntryCategories(ledger, [entry.id], 'expense', 'coffee'),
  );
  expect(changed.entries.map((item) => item.categoryId)).toEqual([
    'coffee',
    'coffee',
  ]);
  expect(ledger.entries.map((item) => item.categoryId)).toEqual([
    'food',
    'food',
  ]);
  expect(() =>
    changeEntryCategories(ledger, [refund.id], 'expense', 'coffee'),
  ).toThrow('账单已变化');
  expect(() =>
    changeEntryCategories(ledger, [entry.id], 'expense', 'salary'),
  ).toThrow('可用分类');
});

test('CSV quoting round-trips Chinese notes and duplicate rows are skipped before writing', () => {
  const ledger = emptyLedger();
  const record = { ...entry, note: '备注, "引号"\n第二行' };
  const display = csv(ledger, [
    record,
    record,
    { ...entry, date: '2026-02-30' },
  ]);
  const plan = previewCsv(display, ledger);
  expect(plan.candidates.map((item) => item.note)).toEqual([record.note]);
  expect(plan.issues).toEqual([
    { record: 2, duplicate: true, message: '疑似重复' },
    { record: 3, message: '日期须为 YYYY-MM-DD' },
  ]);
  expect(
    previewCsv(display, { ...ledger, entries: [record] }).candidates,
  ).toHaveLength(0);
  expect(() => previewCsv('错误表头\n"破损内容', ledger)).toThrow();
});

test('category budgets round-trip only for valid expense categories without rewriting the monthly budget', () => {
  const source = {
    ...emptyLedger(),
    monthlyBudget: 10000,
    categoryBudgets: [{ categoryId: 'food', amount: 5000 }],
  };
  expect(validateLedger(JSON.parse(JSON.stringify(source)))).toEqual(source);
  expect(validateLedger(emptyLedger())).not.toHaveProperty('categoryBudgets');
  expect(() =>
    validateLedger({
      ...source,
      categoryBudgets: [{ categoryId: 'salary', amount: 5000 }],
    }),
  ).toThrow('分类预算');
  expect(() =>
    validateLedger({
      ...source,
      categoryBudgets: [...source.categoryBudgets, ...source.categoryBudgets],
    }),
  ).toThrow('重复');
});

test('backup reread tests the recorded file and preserves every existing file', async () => {
  const p = {
    ...defaultBackupPreferences(),
    installationId: 'install-123',
    directory: 'directory',
    lastFileName: 'qingzhang-auto-install-123-20261120T040000123Z-copy.json',
  };
  const file = { name: p.lastFileName, uri: 'current' };
  const read = vi
    .fn()
    .mockResolvedValue(JSON.stringify({ ...emptyLedger(), entries: [entry] }));
  const list = vi.fn().mockResolvedValue([file]);
  const files = { read, list, remove: vi.fn(), write: vi.fn() };
  await expect(checkLatestBackup(files, p)).resolves.toBe(1);
  read.mockResolvedValueOnce('damaged');
  await expect(checkLatestBackup(files, p)).rejects.toThrow('无法恢复');
  list.mockResolvedValueOnce([]);
  await expect(checkLatestBackup(files, p)).rejects.toThrow('找不到');
  expect(files.remove).not.toHaveBeenCalled();
  expect(files.write).not.toHaveBeenCalled();
});

test('launcher URLs allow only the two supported intents', () => {
  expect(shortcutKind('qingzhang-app://record/income')).toBe('income');
  expect(shortcutKind('qingzhang-app://record/expense')).toBe('expense');
  expect(shortcutKind('qingzhang-app://record/transfer')).toBeNull();
  expect(
    shortcutKind('https://qingzhang-app.example/record/income'),
  ).toBeNull();
});

test('spreadsheet-safe CSV text preserves notes, account and category names', () => {
  const ledger = emptyLedger();
  ledger.accounts[0]!.name = '+账户';
  ledger.categories.find((item) => item.id === entry.categoryId)!.label = '=餐饮';
  for (const note of ['@午餐', "'@午餐", "''@午餐", '-' + '零'.repeat(119)]) {
    const record = { ...entry, note };
    const text = csv(ledger, [record]);
    expect(previewCsv(text, ledger).candidates[0]?.note).toBe(note);
    expect(previewCsv(text, { ...ledger, entries: [record] }).issues[0]?.duplicate).toBe(true);
  }
});

test('CSV rejects new movements involving archived accounts in either direction', () => {
  const ledger = emptyLedger();
  ledger.accounts.find((account) => account.id === entry.accountId)!.archived = true;
  const transfer = { ...entry, kind: 'transfer' as const, categoryId: 'transfer', accountId: 'cash', toAccountId: entry.accountId };
  const result = previewCsv(csv(ledger, [entry, transfer]), ledger);
  expect(result.candidates).toHaveLength(0);
  expect(result.issues.map((issue) => issue.message)).toEqual([expect.stringContaining('归档'), expect.stringContaining('归档')]);
});

test('old Android document identifiers resolve only to files owned by this installation', async () => {
  const p = { ...defaultBackupPreferences(), installationId: 'install-123', directory: 'dir', lastFileName: '42' };
  const file = { name: 'qingzhang-auto-install-123-20261120T040000123Z-copy.json', legacyName: '42', uri: 'content://provider/document/42' };
  const files = { list: vi.fn().mockResolvedValue([file]), read: vi.fn().mockResolvedValue(JSON.stringify(emptyLedger())), remove: vi.fn(), write: vi.fn() };
  await expect(checkLatestBackup(files, p)).resolves.toBe(0);
  files.list.mockResolvedValue([{ ...file, name: 'other.json' }]);
  await expect(checkLatestBackup(files, p)).rejects.toThrow();
  expect(files.read).toHaveBeenCalledTimes(1);
});

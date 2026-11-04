export type EntryKind = 'expense' | 'income' | 'transfer' | 'refund';
export type Account = { id: string; name: string; openingBalance: number };
export type Entry = {
  id: string;
  kind: EntryKind;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  originalEntryId?: string;
  date: string;
  note: string;
  createdAt: string;
};
export type Ledger = {
  version: 3;
  accounts: Account[];
  entries: Entry[];
  monthlyBudget: number;
  monthBudgets: Record<string, number>;
  showAccountCards: boolean;
  categories: ManagedCategory[];
  templates: QuickTemplate[];
  defaults: Partial<Record<'expense' | 'income', EntryDefault>>;
};
export type Category = {
  id: string;
  label: string;
  color: string;
  icon: string;
};

export type ManagedCategory = Category & {
  kind: 'expense' | 'income';
  hidden: boolean;
};
export type EntryDefault = { categoryId: string; accountId: string };
export type QuickTemplate = EntryDefault & {
  id: string;
  name: string;
  kind: 'expense' | 'income';
  amount: number;
  note: string;
};
export const categoryIcons = [
  'utensils',
  'coffee',
  'train',
  'shopping-bag',
  'house',
  'gamepad',
  'heart',
  'ellipsis',
  'briefcase',
  'gift',
  'sparkles',
  'plus',
  'wallet',
  'leaf',
  'calendar',
];
export const categoryColors = [
  '#E99764',
  '#B18A69',
  '#6A9FCC',
  '#BB88B6',
  '#C8A76B',
  '#8D8ACB',
  '#D7838B',
  '#548D75',
  '#8B9B93',
];
export function defaultCategories(): ManagedCategory[] {
  return [
    ...expenseCategories.map((c) => ({
      ...c,
      kind: 'expense' as const,
      hidden: false,
    })),
    ...incomeCategories.map((c) => ({
      ...c,
      kind: 'income' as const,
      hidden: false,
    })),
  ];
}
export function categoryFor(ledger: Ledger, categoryId: string): Category {
  return categoryId === 'transfer'
    ? transferCategory
    : ledger.categories.find((c) => c.id === categoryId)!;
}
export function visibleCategories(ledger: Ledger, kind: 'expense' | 'income') {
  return ledger.categories.filter((c) => c.kind === kind && !c.hidden);
}
export function entryDefault(
  ledger: Ledger,
  kind: 'expense' | 'income',
): EntryDefault {
  const saved = ledger.defaults[kind];
  return {
    categoryId:
      visibleCategories(ledger, kind).find((c) => c.id === saved?.categoryId)
        ?.id ?? visibleCategories(ledger, kind)[0]!.id,
    accountId:
      ledger.accounts.find((a) => a.id === saved?.accountId)?.id ??
      ledger.accounts[0]!.id,
  };
}

export const expenseCategories: Category[] = [
  { id: 'food', label: '餐饮', color: '#E99764', icon: 'utensils' },
  { id: 'coffee', label: '咖啡茶饮', color: '#B18A69', icon: 'coffee' },
  { id: 'transport', label: '交通', color: '#6A9FCC', icon: 'train' },
  { id: 'shopping', label: '购物', color: '#BB88B6', icon: 'shopping-bag' },
  { id: 'home', label: '居家', color: '#C8A76B', icon: 'house' },
  { id: 'fun', label: '娱乐', color: '#8D8ACB', icon: 'gamepad' },
  { id: 'health', label: '健康', color: '#D7838B', icon: 'heart' },
  { id: 'other', label: '其他', color: '#8B9B93', icon: 'ellipsis' },
];
export const incomeCategories: Category[] = [
  { id: 'salary', label: '工资', color: '#548D75', icon: 'briefcase' },
  { id: 'bonus', label: '奖金', color: '#C8A76B', icon: 'gift' },
  { id: 'side', label: '副业', color: '#6A9FCC', icon: 'sparkles' },
  { id: 'other-income', label: '其他收入', color: '#8B9B93', icon: 'plus' },
];
export const transferCategory: Category = {
  id: 'transfer',
  label: '转账',
  color: '#6A9FCC',
  icon: 'arrows',
};
export const allCategories = [
  ...expenseCategories,
  ...incomeCategories,
  transferCategory,
];
export const MAX_AMOUNT = 999_999_999;

export function emptyLedger(): Ledger {
  return {
    version: 3,
    monthlyBudget: 0,
    monthBudgets: {},
    showAccountCards: false,
    categories: defaultCategories(),
    templates: [],
    defaults: {},
    accounts: [
      { id: 'wechat', name: '微信', openingBalance: 0 },
      { id: 'alipay', name: '支付宝', openingBalance: 0 },
      { id: 'bank', name: '银行卡', openingBalance: 0 },
      { id: 'cash', name: '现金', openingBalance: 0 },
    ],
    entries: [],
  };
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return localDate(new Date(year, m - 1 + offset, 1)).slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${year} 年 ${Number(m)} 月`;
}

export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  if (y < 1900 || y > 2200) return false;
  return localDate(new Date(y, m - 1, d)) === date;
}

export function parseAmount(raw: string, allowZero = false): number {
  const text = raw.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
    throw new Error('请输入金额，最多保留两位小数');
  const [whole, fraction = ''] = text.split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if ((!allowZero && value === 0) || value > MAX_AMOUNT)
    throw new Error('金额需大于 0，且不超过 9,999,999.99');
  return value;
}

export function amountInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function money(cents: number, decimals = true): string {
  return (cents / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function invariant(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

function isAmount(value: unknown, signed = false): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAX_AMOUNT &&
    (signed || value >= 0)
  );
}

function isText(
  value: unknown,
  max: number,
  required = false,
): value is string {
  return (
    typeof value === 'string' &&
    value.length <= max &&
    (!required || value.trim().length > 0)
  );
}

// A single validation boundary is used for imports, reads and all writes.
export function validateLedger(input: unknown): Ledger {
  invariant(input && typeof input === 'object', '账本格式无效');
  const data = input as Record<string, unknown>;
  invariant(
    data.version === 1 || data.version === 2 || data.version === 3,
    '不支持此备份版本',
  );
  invariant(
    Array.isArray(data.accounts) &&
      data.accounts.length > 0 &&
      data.accounts.length <= 50,
    '账户数据无效',
  );
  invariant(
    Array.isArray(data.entries) && data.entries.length <= 50_000,
    '账单数据无效或超过 50,000 条',
  );
  invariant(isAmount(data.monthlyBudget), '预算金额无效');
  invariant(
    data.showAccountCards === undefined ||
      typeof data.showAccountCards === 'boolean',
    '账户显示设置无效',
  );
  const rawBudgets = data.version === 3 ? data.monthBudgets : {};
  invariant(
    rawBudgets &&
      typeof rawBudgets === 'object' &&
      !Array.isArray(rawBudgets) &&
      Object.keys(rawBudgets).length <= 3612,
    '月份预算格式无效',
  );
  const monthBudgets: Record<string, number> = {};
  for (const [month, amount] of Object.entries(rawBudgets)) {
    invariant(
      /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
        validDate(`${month}-01`) &&
        isAmount(amount),
      '月份预算无效',
    );
    monthBudgets[month] = amount;
  }
  const ids = new Set<string>();
  const accounts: Account[] = data.accounts.map((a: unknown) => {
    invariant(a && typeof a === 'object', '账户格式无效');
    const x = a as Record<string, unknown>;
    invariant(isText(x.id, 100, true) && !ids.has(x.id), '账户标识重复或无效');
    invariant(
      isText(x.name, 20, true) && isAmount(x.openingBalance, true),
      '账户名称或初始余额无效',
    );
    ids.add(x.id);
    return { id: x.id, name: x.name.trim(), openingBalance: x.openingBalance };
  });
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  const rawCategories =
    data.version === 1 ? defaultCategories() : data.categories;
  invariant(
    Array.isArray(rawCategories) && rawCategories.length <= 100,
    '分类数据无效',
  );
  const categories: ManagedCategory[] = rawCategories.map((raw: unknown) => {
    invariant(raw && typeof raw === 'object', '分类格式无效');
    const c = raw as Record<string, unknown>;
    invariant(
      isText(c.id, 100, true) && c.id !== 'transfer' && !categoryIds.has(c.id),
      '分类标识重复或无效',
    );
    invariant(c.kind === 'expense' || c.kind === 'income', '分类类型无效');
    invariant(isText(c.label, 20, true), '分类名称需为 1 至 20 字');
    const name = c.kind + ':' + c.label.trim();
    invariant(!categoryNames.has(name), '同类分类名称不能重复');
    invariant(
      typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color),
      '分类颜色无效',
    );
    invariant(
      typeof c.icon === 'string' && categoryIcons.includes(c.icon),
      '分类图标无效',
    );
    invariant(typeof c.hidden === 'boolean', '分类显示设置无效');
    categoryIds.add(c.id);
    categoryNames.add(name);
    return {
      id: c.id,
      kind: c.kind,
      label: c.label.trim(),
      color: c.color,
      icon: c.icon,
      hidden: c.hidden,
    };
  });
  for (const kind of ['expense', 'income'])
    invariant(
      categories.some((c) => c.kind === kind && !c.hidden),
      '至少保留一个可用的支出和收入分类',
    );
  const entryIds = new Set<string>();
  const entries: Entry[] = data.entries.map((a: unknown) => {
    invariant(a && typeof a === 'object', '账单格式无效');
    const x = a as Record<string, unknown>;
    invariant(
      isText(x.id, 100, true) && !entryIds.has(x.id),
      '账单标识重复或无效',
    );
    invariant(
      x.kind === 'income' ||
        x.kind === 'expense' ||
        x.kind === 'transfer' ||
        (data.version !== 1 && x.kind === 'refund'),
      '收支类型无效',
    );
    invariant(isAmount(x.amount) && x.amount > 0, '账单金额无效');
    invariant(
      isText(x.date, 10) && validDate(x.date),
      '日期无效，请使用 YYYY-MM-DD',
    );
    invariant(isText(x.note, 120), '备注不能超过 120 字');
    invariant(
      isText(x.createdAt, 40) && Number.isFinite(Date.parse(x.createdAt)),
      '创建时间无效',
    );
    invariant(
      isText(x.accountId, 100) && ids.has(x.accountId),
      '请选择有效账户',
    );
    if (x.kind === 'transfer') {
      invariant(
        isText(x.toAccountId, 100) &&
          ids.has(x.toAccountId) &&
          x.toAccountId !== x.accountId,
        '转出和转入账户不能相同',
      );
      invariant(x.categoryId === 'transfer', '转账分类无效');
    } else {
      invariant(
        categories.some(
          (c) =>
            c.id === x.categoryId &&
            c.kind === (x.kind === 'income' ? 'income' : 'expense'),
        ),
        '请选择有效分类',
      );
    }
    if (x.kind === 'refund')
      invariant(isText(x.originalEntryId, 100, true), '请选择退款关联的原支出');
    entryIds.add(x.id);
    return {
      id: x.id,
      kind: x.kind,
      amount: x.amount,
      categoryId: x.categoryId as string,
      accountId: x.accountId,
      date: x.date,
      note: x.note.trim(),
      createdAt: x.createdAt,
      ...(x.kind === 'transfer'
        ? { toAccountId: x.toAccountId as string }
        : {}),
      ...(x.kind === 'refund'
        ? { originalEntryId: x.originalEntryId as string }
        : {}),
    };
  });
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const refunded = refundAmounts(entries);
  for (const refund of entries.filter((e) => e.kind === 'refund')) {
    const original = entryMap.get(refund.originalEntryId!);
    invariant(original?.kind === 'expense', '退款缺少原支出，请先删除关联退款');
    invariant(
      refund.categoryId === original.categoryId,
      '退款分类需与原支出一致',
    );
    invariant(refund.date >= original.date, '退款日期不能早于原支出');
    invariant(
      (refunded.get(original.id) ?? 0) <= original.amount,
      '累计退款不能超过原支出金额',
    );
  }
  const rawTemplates = data.version === 1 ? [] : data.templates;
  invariant(
    Array.isArray(rawTemplates) && rawTemplates.length <= 30,
    '常用项不能超过 30 个',
  );
  const templateIds = new Set<string>();
  const templates: QuickTemplate[] = rawTemplates.map((raw: unknown) => {
    invariant(raw && typeof raw === 'object', '常用项格式无效');
    const x = raw as Record<string, unknown>;
    invariant(
      isText(x.id, 100, true) && !templateIds.has(x.id),
      '常用项标识无效',
    );
    invariant(
      isText(x.name, 20, true) && isText(x.note, 120),
      '常用项名称或备注无效',
    );
    invariant(x.kind === 'expense' || x.kind === 'income', '常用项类型无效');
    invariant(isAmount(x.amount) && x.amount > 0, '常用项金额无效');
    invariant(
      isText(x.accountId, 100) && ids.has(x.accountId),
      '常用项账户无效',
    );
    invariant(
      isText(x.categoryId, 100) &&
        categories.some((c) => c.id === x.categoryId && c.kind === x.kind),
      '常用项分类无效',
    );
    templateIds.add(x.id);
    return {
      id: x.id,
      name: x.name.trim(),
      note: x.note.trim(),
      kind: x.kind,
      amount: x.amount,
      accountId: x.accountId,
      categoryId: x.categoryId,
    };
  });
  const rawDefaults = data.version === 1 ? {} : data.defaults;
  invariant(
    rawDefaults &&
      typeof rawDefaults === 'object' &&
      !Array.isArray(rawDefaults),
    '记账偏好无效',
  );
  const defaults: Ledger['defaults'] = {};
  for (const kind of ['expense', 'income'] as const) {
    const item = (rawDefaults as Record<string, unknown>)[kind];
    if (item === undefined) continue;
    invariant(item && typeof item === 'object', '记账偏好无效');
    const x = item as Record<string, unknown>;
    invariant(
      isText(x.accountId, 100) &&
        ids.has(x.accountId) &&
        isText(x.categoryId, 100) &&
        categories.some((c) => c.id === x.categoryId && c.kind === kind),
      '记账偏好引用无效',
    );
    defaults[kind] = { accountId: x.accountId, categoryId: x.categoryId };
  }
  return {
    version: 3,
    accounts,
    entries,
    monthlyBudget: data.monthlyBudget,
    monthBudgets,
    showAccountCards: data.showAccountCards ?? false,
    categories,
    templates,
    defaults,
  };
}

export function upsertEntry(
  ledger: Ledger,
  entry: Entry,
  remember = false,
): Ledger {
  const entries = [
    ...ledger.entries.filter((e) => e.id !== entry.id),
    entry,
  ].map((e) =>
    e.kind === 'refund' &&
    e.originalEntryId === entry.id &&
    entry.kind === 'expense'
      ? { ...e, categoryId: entry.categoryId }
      : e,
  );
  return validateLedger({
    ...ledger,
    entries,
    defaults:
      remember && (entry.kind === 'expense' || entry.kind === 'income')
        ? {
            ...ledger.defaults,
            [entry.kind]: {
              accountId: entry.accountId,
              categoryId: entry.categoryId,
            },
          }
        : ledger.defaults,
  });
}
export function deleteEntry(ledger: Ledger, entryId: string): Ledger {
  invariant(
    !ledger.entries.some((e) => e.originalEntryId === entryId),
    '请先删除这笔支出的关联退款',
  );
  return validateLedger({
    ...ledger,
    entries: ledger.entries.filter((e) => e.id !== entryId),
  });
}
export function restoreEntry(ledger: Ledger, entry: Entry): Ledger {
  invariant(
    !ledger.entries.some((item) => item.id === entry.id),
    '同一账单已存在，不能重复恢复',
  );
  return upsertEntry(ledger, entry);
}
export function refundAmounts(entries: Entry[]): Map<string, number> {
  const values = new Map<string, number>();
  for (const entry of entries)
    if (entry.kind === 'refund' && entry.originalEntryId)
      values.set(
        entry.originalEntryId,
        (values.get(entry.originalEntryId) ?? 0) + entry.amount,
      );
  return values;
}
export function remainingRefund(ledger: Ledger, expense: Entry): number {
  return expense.kind === 'expense'
    ? expense.amount - (refundAmounts(ledger.entries).get(expense.id) ?? 0)
    : 0;
}

export function accountBalance(ledger: Ledger, accountId: string): number {
  return ledger.entries.reduce(
    (sum, e) => {
      if (e.kind === 'transfer')
        return (
          sum -
          (e.accountId === accountId ? e.amount : 0) +
          (e.toAccountId === accountId ? e.amount : 0)
        );
      return (
        sum +
        (e.accountId === accountId
          ? e.amount * (e.kind === 'income' || e.kind === 'refund' ? 1 : -1)
          : 0)
      );
    },
    ledger.accounts.find((a) => a.id === accountId)?.openingBalance ?? 0,
  );
}

export function monthEntries(ledger: Ledger, month: string): Entry[] {
  return ledger.entries
    .filter((e) => e.date.startsWith(month))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}

// Refunds reduce the original expense's period; account balances use actual refund records.
export function totals(entries: Entry[], allEntries = entries) {
  const refunds = refundAmounts(allEntries);
  return entries.reduce(
    (total, entry) => {
      if (entry.kind === 'income') total.income += entry.amount;
      if (entry.kind === 'expense')
        total.expense += entry.amount - (refunds.get(entry.id) ?? 0);
      return total;
    },
    { income: 0, expense: 0 },
  );
}
export function categoryTotals(
  entries: Entry[],
  categories: Category[] = expenseCategories,
  allEntries = entries,
) {
  const refunds = refundAmounts(allEntries);
  const amounts = new Map<string, number>();
  for (const entry of entries)
    if (entry.kind === 'expense')
      amounts.set(
        entry.categoryId,
        (amounts.get(entry.categoryId) ?? 0) +
          entry.amount -
          (refunds.get(entry.id) ?? 0),
      );
  return categories
    .map((c) => ({ ...c, total: amounts.get(c.id) ?? 0 }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function demoLedger(now = new Date()): Ledger {
  const ledger = emptyLedger();
  ledger.monthlyBudget = 500_000;
  ledger.accounts[0]!.openingBalance = 125_000;
  ledger.accounts[1]!.openingBalance = 80_000;
  ledger.accounts[2]!.openingBalance = 360_000;
  const examples: [EntryKind, number, string, string, string, number][] = [
    ['income', 1_280_000, 'salary', 'bank', '认真生活，也认真工作', 0],
    ['expense', 2800, 'coffee', 'wechat', '一杯拿铁，开启今天', 0],
    ['expense', 3850, 'food', 'alipay', '好好吃饭', 0],
    ['expense', 600, 'transport', 'wechat', '地铁通勤', 1],
    ['expense', 12900, 'shopping', 'alipay', '给生活添一点喜欢', 2],
    ['expense', 6800, 'food', 'wechat', '和朋友的晚餐', 3],
    ['expense', 4800, 'fun', 'alipay', '周末电影', 5],
    ['expense', 19900, 'home', 'bank', '一盏温暖的小灯', 7],
    ['expense', 2400, 'coffee', 'wechat', '午后的一点松弛', 9],
  ];
  ledger.entries = examples.map(
    ([kind, amount, categoryId, accountId, note, days], i) => ({
      id: `sample-${i}`,
      kind,
      amount,
      categoryId,
      accountId,
      note,
      date: localDate(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          Math.max(1, now.getDate() - days),
        ),
      ),
      createdAt: new Date(now.getTime() - i * 60_000).toISOString(),
    }),
  );
  return validateLedger(ledger);
}

export function csv(ledger: Ledger): string {
  const cell = (value: string) =>
    `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [
      [
        '日期',
        '类型',
        '分类',
        '金额（元）',
        '账户',
        '转入账户',
        '备注',
        '关联原账单',
      ],
      ...[...ledger.entries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [
          e.date,
          { income: '收入', expense: '支出', transfer: '转账', refund: '退款' }[
            e.kind
          ],
          categoryFor(ledger, e.categoryId)?.label ?? '',
          amountInput(e.amount),
          ledger.accounts.find((a) => a.id === e.accountId)?.name ?? '',
          ledger.accounts.find((a) => a.id === e.toAccountId)?.name ?? '',
          e.note,
          e.originalEntryId ?? '',
        ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}

export function budgetForMonth(ledger: Ledger, month: string): number {
  return ledger.monthBudgets[month] ?? ledger.monthlyBudget;
}

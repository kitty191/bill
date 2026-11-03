export type EntryKind = 'expense' | 'income' | 'transfer';
export type Account = { id: string; name: string; openingBalance: number };
export type Entry = {
  id: string;
  kind: EntryKind;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  date: string;
  note: string;
  createdAt: string;
};
export type Ledger = {
  version: 1;
  accounts: Account[];
  entries: Entry[];
  monthlyBudget: number;
  showAccountCards: boolean;
};
export type Category = {
  id: string;
  label: string;
  color: string;
  icon: string;
};

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
    version: 1,
    monthlyBudget: 0,
    showAccountCards: false,
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
  invariant(data.version === 1, '不支持此备份版本');
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
  const entryIds = new Set<string>();
  const entries: Entry[] = data.entries.map((a: unknown) => {
    invariant(a && typeof a === 'object', '账单格式无效');
    const x = a as Record<string, unknown>;
    invariant(
      isText(x.id, 100, true) && !entryIds.has(x.id),
      '账单标识重复或无效',
    );
    invariant(
      x.kind === 'income' || x.kind === 'expense' || x.kind === 'transfer',
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
        (x.kind === 'income' ? incomeCategories : expenseCategories).some(
          (c) => c.id === x.categoryId,
        ),
        '请选择有效分类',
      );
    }
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
    };
  });
  return {
    version: 1,
    accounts,
    entries,
    monthlyBudget: data.monthlyBudget,
    showAccountCards: data.showAccountCards ?? false,
  };
}

export function upsertEntry(ledger: Ledger, entry: Entry): Ledger {
  return validateLedger({
    ...ledger,
    entries: [...ledger.entries.filter((e) => e.id !== entry.id), entry],
  });
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
          ? e.amount * (e.kind === 'income' ? 1 : -1)
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

export function totals(entries: Entry[]) {
  return entries.reduce(
    (t, e) => {
      if (e.kind === 'income') t.income += e.amount;
      if (e.kind === 'expense') t.expense += e.amount;
      return t;
    },
    { income: 0, expense: 0 },
  );
}

export function categoryTotals(entries: Entry[]) {
  return expenseCategories
    .map((category) => ({
      ...category,
      total: entries
        .filter((e) => e.kind === 'expense' && e.categoryId === category.id)
        .reduce((s, e) => s + e.amount, 0),
    }))
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
      ['日期', '类型', '分类', '金额（元）', '账户', '转入账户', '备注'],
      ...[...ledger.entries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [
          e.date,
          { income: '收入', expense: '支出', transfer: '转账' }[e.kind],
          allCategories.find((c) => c.id === e.categoryId)?.label ?? '',
          amountInput(e.amount),
          ledger.accounts.find((a) => a.id === e.accountId)?.name ?? '',
          ledger.accounts.find((a) => a.id === e.toAccountId)?.name ?? '',
          e.note,
        ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}

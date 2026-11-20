import { expect, test } from '@playwright/test';
import { emptyLedger, type Entry } from '../src/domain/ledger';

const key = 'qingzhang.ledger.v1';
const expense: Entry = {
  id: 'october-payment',
  kind: 'expense',
  amount: 14000,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-10-26',
  createdAt: '2026-10-26T04:00:00Z',
  note: '十月支出',
};

test('reconciles a monthly account without writing and opens its matching cash movements', async ({
  page,
}) => {
  const ledger = {
    ...emptyLedger(),
    showAccountCards: true,
    entries: [
      expense,
      {
        ...expense,
        id: 'refund',
        kind: 'refund',
        originalEntryId: expense.id,
        amount: 2500,
        date: '2026-11-05',
        note: '十一月到账退款',
      },
      {
        ...expense,
        id: 'transfer-in',
        kind: 'transfer',
        categoryId: 'transfer',
        accountId: 'bank',
        toAccountId: 'wechat',
        amount: 1000,
        date: '2026-11-06',
        note: '转入微信',
      },
      {
        ...expense,
        id: 'transfer-out',
        kind: 'transfer',
        categoryId: 'transfer',
        toAccountId: 'bank',
        amount: 900,
        date: '2026-11-07',
        note: '转出微信',
      },
      {
        ...expense,
        id: 'future',
        date: '2026-11-30',
        amount: 500,
        note: '未到日期的支出',
      },
    ],
  };
  ledger.accounts.find((account) => account.id === 'wechat')!.openingBalance =
    10000;
  await page.clock.setFixedTime(new Date('2026-11-20T04:00:00Z'));
  await page.addInitScript(
    ({ key, ledger }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(ledger));
    },
    { key, ledger },
  );
  await page.goto('/');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await button('查看微信账户明细').click();
  await expect(
    page.getByText('2026-11-01 至 2026-11-20', { exact: true }),
  ).toBeVisible();
  const amount = (label: string) =>
    page.getByText(label, { exact: true }).locator('..');
  await expect(amount('期初余额')).toContainText('-40.00');
  await expect(amount('期间流入')).toContainText('35.00');
  await expect(amount('期间流出')).toContainText('9.00');
  await expect(amount('截至今日余额')).toContainText('-14.00');
  const actual = page.getByRole('textbox', { name: '实际余额', exact: true });
  await actual.fill('1.005');
  await button('开始核对').click();
  await expect(
    page.getByText('请输入有效的实际余额，最多保留两位小数'),
  ).toBeVisible();
  await actual.fill('-16');
  await button('开始核对').click();
  await expect(page.getByText('实际余额比账面少 ¥2.00')).toBeVisible();
  await actual.fill('-14');
  await button('开始核对').click();
  await expect(page.getByText('实际余额与账面一致')).toBeVisible();
  await button('账户明细上个月').click();
  await expect(amount('期末余额')).toContainText('-40.00');
  await expect(actual).toHaveValue('');
  await button('账户明细下个月').click();
  await button('查看期间流水').click();
  await expect(
    page.getByRole('tab', { name: '账单', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('active-entry-filters')).toHaveText(
    '2026-11-01 至 2026-11-20 · 微信 · 3 笔',
  );
  const entry = (note: string) =>
    page.getByTestId('page-entries').getByRole('button', {
      name: new RegExp(`${note}.*查看详情`),
    });
  for (const note of ['十一月到账退款', '转入微信', '转出微信'])
    await expect(entry(note)).toBeVisible();
  for (const note of ['十月支出', '未到日期的支出'])
    await expect(entry(note)).toHaveCount(0);
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(stored).toEqual(ledger);
});

test('settings keeps its in-progress budget after closing account details and masks balances', async ({
  page,
}) => {
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await page.goto('/');
  await button('隐藏金额').click();
  await button('打开设置').click();
  const budget = page.getByRole('textbox', { name: '月度预算金额', exact: true });
  await budget.fill('45.00');
  await button('核对微信余额').click();
  await expect(page.getByText('显示金额后可核对余额。')).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: '实际余额', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('期初余额', { exact: true }).locator('..'),
  ).toContainText('••••');
  await button('关闭').click();
  await expect(budget).toHaveValue('45.00');
});

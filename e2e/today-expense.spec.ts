import { test, expect, type Page } from '@playwright/test';
import { emptyLedger, type Entry, type Ledger } from '../src/domain/ledger';

const key = 'qingzhang.ledger.v1';
function expense(id: string, date: string, amount: number): Entry {
  return {
    id,
    kind: 'expense',
    amount,
    categoryId: 'food',
    accountId: 'wechat',
    date,
    note: id,
    createdAt: `${date}T04:00:00Z`,
  };
}
async function seed(page: Page, ledger: Ledger) {
  await page.addInitScript(
    ({ key, ledger }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(ledger));
    },
    { key, ledger },
  );
  await page.goto('/');
}

test('today spending follows entry dates and net refunds, independent of the selected month, with privacy protection', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await page.setViewportSize({ width: 320, height: 740 });
  const ledger = emptyLedger();
  ledger.entries = [
    expense('今日午饭', '2026-11-04', 1234),
    expense('今日购物', '2026-11-04', 1000),
    expense('昨天购物', '2026-11-03', 10000),
    expense('上月消费', '2026-10-31', 90000),
    expense('明日消费', '2026-11-05', 9999),
    {
      ...expense('今日收入', '2026-11-04', 500000),
      kind: 'income',
      categoryId: 'salary',
    },
    {
      ...expense('今日转账', '2026-11-04', 5000),
      kind: 'transfer',
      categoryId: 'transfer',
      toAccountId: 'alipay',
    },
    {
      ...expense('退回今日购物', '2026-11-04', 200),
      kind: 'refund',
      originalEntryId: '今日购物',
    },
    {
      ...expense('退回昨天购物', '2026-11-04', 3000),
      kind: 'refund',
      originalEntryId: '昨天购物',
    },
  ];
  await seed(page, ledger);
  await expect(page.getByTestId('today-expense')).toHaveText('¥20.34');
  await expect(page.getByTestId('today-expense')).toBeInViewport();
  await page.screenshot({ path: '/tmp/qingzhang-v032-today-light.png' });
  await page.getByRole('button', { name: '上个月', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('900.00');
  await expect(page.getByTestId('today-expense')).toHaveText('¥20.34');
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥••••');
  await expect(page.getByTestId('today-expense')).not.toHaveAttribute(
    'aria-label',
    /20\.34/,
  );
  await page.reload();
  await expect(page.getByTestId('today-expense')).toHaveText('¥••••');
  await page.getByRole('button', { name: '显示金额', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByTestId('today-expense')).toHaveText('¥20.34');
  await page.screenshot({ path: '/tmp/qingzhang-v032-today-dark.png' });
});

test('local midnight resets only the daily summary without interaction or data loss, and new entries use the new date', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-12-31T15:59:40Z') });
  const ledger = emptyLedger();
  ledger.entries = [
    expense('跨年前晚饭', '2026-12-31', 1850),
    expense('昨天早餐', '2026-12-30', 990),
  ];
  await seed(page, ledger);
  await expect(page.getByTestId('today-expense')).toHaveText('¥18.50');
  // Let the pager finish its initial layout before pausing animation frames.
  await page.clock.pauseAt(new Date('2026-12-31T15:59:59Z'));
  const original = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.clock.runFor(1000);
  await page.clock.resume();
  await expect(page.getByTestId('today-expense')).toHaveText('¥0.00');
  await expect(page.getByTestId('month-expense')).toHaveText('28.40');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    original,
  );
  await page.getByRole('button', { name: /^查看今日支出明细/ }).click();
  await expect(page.getByTestId('active-entry-filters')).toHaveText(
    '2027-01-01 至 2027-01-01 · 0 笔',
  );
  await expect(page.getByText('今天还没有支出', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '记下今天第一笔', exact: true })
    .click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('1.25');
  await expect(
    page.getByRole('textbox', { name: '记账日期', exact: true }),
  ).toHaveValue('2027-01-01');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥1.25');
  await expect(page.getByTestId('month-expense')).toHaveText('1.25');
  await page.reload();
  await expect(page.getByTestId('today-expense')).toHaveText('¥1.25');
});

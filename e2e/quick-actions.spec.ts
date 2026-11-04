import { test, expect, type Page } from '@playwright/test';
import { emptyLedger, type Entry } from '../src/domain/ledger';

const key = 'qingzhang.ledger.v1';
const quickEdit = (page: Page) =>
  page.getByRole('button', { name: '修改刚保存的账单', exact: true });
const bills = (page: Page) => page.getByTestId('page-entries');
const expense = (id: string, date: string, amount: number): Entry => ({
  id,
  date,
  amount,
  kind: 'expense',
  categoryId: 'food',
  accountId: 'wechat',
  note: id,
  createdAt: `${date}T04:00:00Z`,
});
async function stored(page: Page): Promise<ReturnType<typeof emptyLedger>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function record(page: Page, amount: string, note: string) {
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill(amount);
  await page.getByRole('textbox', { name: '备注', exact: true }).fill(note);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(quickEdit(page)).toBeVisible();
}

test('today opens matching expense details, clears old filters, and supports repeat visits and View all', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  const ledger = emptyLedger();
  ledger.entries = [
    expense('今天晚餐', '2026-11-04', 10000),
    expense('昨天购物', '2026-11-03', 3000),
    expense('上月购物', '2026-10-31', 9000),
    {
      ...expense('退回部分晚餐', '2026-11-04', 2000),
      kind: 'refund',
      originalEntryId: '今天晚餐',
    },
    {
      ...expense('退回昨天购物', '2026-11-04', 1000),
      kind: 'refund',
      originalEntryId: '昨天购物',
    },
    {
      ...expense('今天工资', '2026-11-04', 500000),
      kind: 'income',
      categoryId: 'salary',
    },
    {
      ...expense('今天转账', '2026-11-04', 1000),
      kind: 'transfer',
      categoryId: 'transfer',
      toAccountId: 'alipay',
    },
  ];
  await page.addInitScript(
    ({ key, ledger }) => localStorage.setItem(key, JSON.stringify(ledger)),
    { key, ledger },
  );
  await page.goto('/');
  await expect(page.getByTestId('today-expense')).toHaveText('¥80.00');
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await page.getByRole('button', { name: '筛选收入', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索账单' }).fill('不存在的内容');
  await page.getByRole('button', { name: '打开组合筛选' }).click();
  await page.getByRole('button', { name: '自定义日期', exact: true }).click();
  await page
    .getByRole('textbox', { name: '开始日期', exact: true })
    .fill('2026-10-01');
  await page
    .getByRole('textbox', { name: '结束日期', exact: true })
    .fill('2026-10-31');
  await page.getByRole('button', { name: '筛选分类工资', exact: true }).click();
  await page
    .getByRole('button', { name: '筛选账户支付宝', exact: true })
    .click();
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page
    .getByTestId('page-home')
    .getByRole('button', { name: '上个月', exact: true })
    .click();
  await expect(page.getByTestId('month-expense')).toHaveText('90.00');
  await page.getByRole('button', { name: /^查看今日支出明细/ }).click();
  await expect(
    page.getByRole('tab', { name: '账单', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: '搜索账单' })).toHaveValue('');
  await expect(page.getByTestId('active-entry-filters')).toHaveText(
    '2026-11-04 至 2026-11-04 · 1 笔',
  );
  await expect(bills(page).getByText('¥80.00', { exact: true })).toBeVisible();
  await expect(page.getByTestId('expense-refund-summary')).toHaveText(
    '原支出 ¥100.00 · 已退 ¥20.00',
  );
  await expect(
    bills(page).getByRole('button', { name: /今天晚餐.*查看详情/ }),
  ).toBeVisible();
  for (const note of [
    '昨天购物',
    '上月购物',
    '今天工资',
    '今天转账',
    '退回部分晚餐',
    '退回昨天购物',
  ])
    await expect(
      bills(page).getByRole('button', {
        name: new RegExp(`${note}.*查看详情`),
      }),
    ).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/qingzhang-v033-today-details-light.png',
  });
  await page.getByRole('textbox', { name: '搜索账单' }).fill('不存在');
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  const todayButton = page.getByRole('button', { name: /^查看今日支出明细/ });
  await expect(todayButton).not.toHaveAttribute('aria-label', /80\.00/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await todayButton.click();
  await expect(page.getByRole('textbox', { name: '搜索账单' })).toHaveValue('');
  await expect(bills(page).getByText('¥••••', { exact: true })).toHaveCount(2);
  await expect(page.getByTestId('expense-refund-summary')).toHaveText(
    '原支出 ¥•••• · 已退 ¥••••',
  );
  await page.screenshot({ path: '/tmp/qingzhang-v033-today-details-dark.png' });
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('button', { name: '查看全部', exact: true }).click();
  await expect(page.getByTestId('active-entry-filters')).toHaveCount(0);
  await expect(
    bills(page).getByRole('button', { name: /今天工资.*查看详情/ }),
  ).toBeVisible();
});

test('quick edit targets the latest successful save, resets identical notices, preserves identity, and expires', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByTestId('today-expense')).toHaveText('¥0.00');
  await page.clock.install();
  await record(page, '10', '第一笔');
  await page.clock.fastForward(6000);
  await record(page, '20', '第二笔');
  const original = (await stored(page)).entries.find(
    (entry) => entry.note === '第二笔',
  )!;
  await page.clock.fastForward(3000);
  await expect(quickEdit(page)).toBeInViewport();
  await page.screenshot({ path: '/tmp/qingzhang-v033-quick-edit-light.png' });
  await quickEdit(page).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('20.00');
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('第二笔');
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('23');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥33.00');
  const ledger = await stored(page);
  expect(ledger.entries).toHaveLength(2);
  expect(ledger.entries.find((entry) => entry.id === original.id)).toEqual({
    ...original,
    amount: 2300,
  });
  await page.clock.fastForward(8100);
  await expect(quickEdit(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('today-expense')).toHaveText('¥33.00');
  await expect(quickEdit(page)).toHaveCount(0);
});

test('quick edit and deletion undo coexist and edit mode does not discard the undo action', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '10', '待删除的一笔');
  await quickEdit(page).click();
  await page.getByRole('button', { name: '删除这笔账单', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '撤销删除', exact: true }),
  ).toBeVisible();
  await record(page, '20', '新记的一笔');
  await expect(
    page.getByRole('button', { name: '撤销删除', exact: true }),
  ).toBeVisible();
  await quickEdit(page).click();
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('新记的一笔');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '撤销删除', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥30.00');
  expect((await stored(page)).entries).toHaveLength(2);
});

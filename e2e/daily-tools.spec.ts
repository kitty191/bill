import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { emptyLedger, localDate, type Entry } from '../src/domain/ledger';
import { shiftDay } from '../src/domain/dates';

const key = 'qingzhang.ledger.v1';
async function settings(page: Page) {
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
}
async function record(page: Page, amount: string, note: string) {
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill(amount);
  await page.getByRole('textbox', { name: '备注', exact: true }).fill(note);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function seed(page: Page, ledger: object) {
  await page.addInitScript(
    ({ key, ledger }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(ledger));
    },
    { key, ledger },
  );
  await page.goto('/');
}
const expense: Entry = {
  id: 'food',
  kind: 'expense',
  amount: 1000,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-10-31',
  note: '十月晚饭',
  createdAt: '2026-10-31T10:00:00Z',
};

test('plus opens the keypad immediately and records the expression directly without equals', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await expect(page.getByTestId('amount-calculator')).toBeInViewport();
  await expect(
    page.getByRole('button', { name: '计算键7', exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole('button', { name: '记好了', exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole('button', { name: '打开金额计算器', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('1/0');
  await page.getByRole('button', { name: '计算结果', exact: true }).click();
  await expect(page.getByTestId('calculator-error')).toContainText(
    '不能除以 0',
  );
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('1/0');
  await page
    .getByRole('textbox', { name: '金额', exact: true })
    .fill('(26+15)/2');
  await expect(page.getByTestId('calculation-preview')).toHaveText('= ¥20.50');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('20.50');
});

test('calendar details are accessible while the primary action stays visible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('12');
  await page
    .getByRole('button', { name: '选择分类、账户和日期', exact: true })
    .click();
  await page.getByRole('button', { name: '记账日期昨天', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '记账日期', exact: true }),
  ).toHaveValue(shiftDay(localDate(), -1));
  await page
    .getByRole('textbox', { name: '记账日期', exact: true })
    .fill('2024-02-01');
  await expect(
    page.getByRole('textbox', { name: '记账日期', exact: true }),
  ).toHaveValue('2024-02-01');
  await page.getByRole('button', { name: '选择记账日期', exact: true }).click();
  await expect(page.getByTestId('calendar-记账日期')).toBeInViewport();
  await expect(
    page.getByRole('button', { name: '记好了', exact: true }),
  ).toBeInViewport();
  await page
    .getByRole('button', { name: '记账日期选择2024-02-29', exact: true })
    .click();
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('12.00');
  expect((await saved(page)).entries[0].date).toBe('2024-02-29');
});

test('prefilled templates and edited records support replacement and continued calculation', async ({
  page,
}) => {
  await seed(page, {
    ...emptyLedger(),
    templates: [
      {
        id: 'breakfast',
        name: '早餐',
        kind: 'expense',
        amount: 1850,
        categoryId: 'food',
        accountId: 'wechat',
        note: '早餐',
      },
    ],
  });
  await page.getByRole('button', { name: '常用记账早餐', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('18.50');
  await page.getByRole('button', { name: '计算键2', exact: true }).click();
  await page.getByRole('button', { name: '计算键5', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('25');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('25.00');
  await page.getByRole('button', { name: /早餐.*查看详情/ }).click();
  await page.getByRole('button', { name: '计算键+', exact: true }).click();
  await page.getByRole('button', { name: '计算键2', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('27.00');
});

test('combined filters search across month boundaries and validate date order', async ({
  page,
}) => {
  await seed(page, {
    ...emptyLedger(),
    entries: [
      expense,
      {
        ...expense,
        id: 'alipay',
        accountId: 'alipay',
        date: '2026-11-02',
        note: '十一月晚饭',
        amount: 2000,
      },
      {
        ...expense,
        id: 'coffee',
        categoryId: 'coffee',
        date: '2026-11-01',
        note: '十一月咖啡',
      },
    ],
  });
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await page.getByRole('button', { name: '打开组合筛选', exact: true }).click();
  await page.getByRole('button', { name: '自定义日期', exact: true }).click();
  await page.getByRole('button', { name: '选择开始日期', exact: true }).click();
  await expect(page.getByTestId('calendar-开始日期')).toBeInViewport();
  await page.getByRole('button', { name: '选择结束日期', exact: true }).click();
  await expect(page.getByTestId('calendar-开始日期')).toHaveCount(0);
  await expect(page.getByTestId('calendar-结束日期')).toBeInViewport();
  await page.getByRole('button', { name: '选择结束日期', exact: true }).click();
  await page
    .getByRole('textbox', { name: '开始日期', exact: true })
    .fill('2026-11-03');
  await page
    .getByRole('textbox', { name: '结束日期', exact: true })
    .fill('2026-11-02');
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(page.getByTestId('filter-error')).toContainText(
    '开始日期不能晚于',
  );
  await page
    .getByRole('textbox', { name: '开始日期', exact: true })
    .fill('2026-10-31');
  await page.getByRole('button', { name: '筛选分类餐饮', exact: true }).click();
  await page.getByRole('button', { name: '筛选账户微信', exact: true }).click();
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /十月晚饭.*查看详情/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /十一月.*查看详情/ }),
  ).toHaveCount(0);
  await expect(page.getByTestId('active-entry-filters')).toContainText('1 笔');
  await page
    .getByRole('textbox', { name: '搜索账单', exact: true })
    .fill('不存在');
  await expect(
    page.getByText('没有找到这些账单', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /十一月.*查看详情/ }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: /十月晚饭.*查看详情/ }),
  ).toHaveCount(0);
});

test('monthly budgets stay independent and round-trip in JSON', async ({
  page,
}) => {
  await page.goto('/');
  await settings(page);
  await page
    .getByRole('textbox', { name: '月度预算金额', exact: true })
    .fill('1000');
  await page.getByRole('button', { name: '保存预算', exact: true }).click();
  await page.getByRole('button', { name: '预算下个月', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '月度预算金额', exact: true }),
  ).toHaveValue('');
  await page
    .getByRole('textbox', { name: '月度预算金额', exact: true })
    .fill('2000');
  await page.getByRole('button', { name: '保存预算', exact: true }).click();
  await page.getByRole('button', { name: '预算上个月', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '月度预算金额', exact: true }),
  ).toHaveValue('1000.00');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份账本', exact: true }).click();
  const data = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  const month = localDate().slice(0, 7);
  expect(data.version).toBe(4);
  expect(data.monthBudgets[month]).toBe(100000);
  expect(Object.values(data.monthBudgets).sort()).toEqual([100000, 200000]);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(
    page.getByTestId('page-home').getByText('预算 ¥1,000', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '下个月', exact: true }).click();
  await expect(
    page.getByTestId('page-home').getByText('预算 ¥2,000', { exact: true }),
  ).toBeVisible();
  await page.reload();
  expect((await saved(page)).monthBudgets).toEqual(data.monthBudgets);
});

test('a deleted transaction can be restored and the restored balance survives reload', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '30', '撤销测试');
  const original = (await saved(page)).entries[0];
  await page.getByRole('button', { name: /撤销测试.*查看详情/ }).click();
  await page.getByRole('button', { name: '删除这笔账单', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('0.00');
  await page.getByRole('button', { name: '撤销删除', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('30.00');
  expect((await saved(page)).entries).toEqual([original]);
  await page.reload();
  await expect(page.getByTestId('month-expense')).toHaveText('30.00');
});

test('undo expires without resurrecting deleted records', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await record(page, '5', '撤销过期');
  await page.getByRole('button', { name: /撤销过期.*查看详情/ }).click();
  await page.getByRole('button', { name: '删除这笔账单', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '撤销删除', exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(9000);
  await expect(
    page.getByRole('button', { name: '撤销删除', exact: true }),
  ).toHaveCount(0);
  expect((await saved(page)).entries).toEqual([]);
});

test('v2 migration prefers the latest original snapshot and blocks writes when it cannot save it', async ({
  page,
}) => {
  const { monthBudgets, ...base } = emptyLedger();
  const source = {
    ...base,
    version: 2,
    monthlyBudget: 50000,
    entries: [expense],
  };
  await page.addInitScript(() =>
    localStorage.setItem(
      'qingzhang.ledger.legacy-v1',
      JSON.stringify({
        version: 1,
        accounts: [{ id: 'old', name: '旧账户', openingBalance: 0 }],
        entries: [],
        monthlyBudget: 0,
      }),
    ),
  );
  await seed(page, source);
  await settings(page);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '导出升级前备份', exact: true })
    .click();
  expect(
    JSON.parse(await readFile((await (await download).path())!, 'utf8')),
  ).toEqual(source);
  await page
    .getByRole('textbox', { name: '月度预算金额', exact: true })
    .fill('1000');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'qingzhang.ledger.before-v3')
        throw new Error('升级前备份无法保存');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '保存预算', exact: true }).click();
  await expect(page.getByTestId('settings-error')).toContainText(
    '升级前备份无法保存',
  );
  expect(await saved(page)).toEqual(source);
  await page.evaluate(() => (window as any).restoreStorage());
  await page.getByRole('button', { name: '保存预算', exact: true }).click();
  await expect.poll(async () => (await saved(page)).version).toBe(4);
  expect((await saved(page)).entries).toEqual(source.entries);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('qingzhang.ledger.before-v3')!),
    ),
  ).toEqual(source);
});

test('calculator and calendar fit narrow dark screens without runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('button', { name: '计算键7', exact: true }).click();
  await page.getByRole('button', { name: '计算键+', exact: true }).click();
  await page.getByRole('button', { name: '计算键3', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '记好了', exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole('button', { name: '计算结果', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: '/tmp/qingzhang-v031-calculator-dark.png' });
  await page.getByRole('button', { name: '计算结果', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('10.00');
  await page.getByRole('button', { name: '选择记账日期', exact: true }).click();
  await expect(page.getByTestId('calendar-记账日期')).toBeInViewport();
  await page.screenshot({ path: '/tmp/qingzhang-v031-calendar-dark.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

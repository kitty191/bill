import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { emptyLedger } from '../src/domain/ledger';
import { defaultPreferences } from '../src/domain/privacy';

const ledgerKey = 'qingzhang.ledger.v1';
const privacyKey = 'qingzhang.device-preferences.v1';

async function settings(page: Page, panel?: string) {
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  if (panel)
    await page.getByRole('button', { name: panel, exact: true }).click();
}
async function startEntry(page: Page, amount: string, note: string) {
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill(amount);
  await page.getByRole('textbox', { name: '备注', exact: true }).fill(note);
}
async function saveEntry(page: Page) {
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ledgerKey,
  );
}
async function seed(page: Page, ledger: object, preferences?: object) {
  await page.addInitScript(
    ({ ledger, preferences, ledgerKey, privacyKey }) => {
      if (localStorage.getItem(ledgerKey) === null)
        localStorage.setItem(ledgerKey, JSON.stringify(ledger));
      if (preferences && localStorage.getItem(privacyKey) === null)
        localStorage.setItem(privacyKey, JSON.stringify(preferences));
    },
    { ledger, preferences, ledgerKey, privacyKey },
  );
  await page.goto('/');
}

test('custom categories can be created, reordered, renamed and hidden without losing history', async ({
  page,
}) => {
  await page.goto('/');
  await settings(page, '分类管理');
  await page.getByRole('button', { name: '新增分类', exact: true }).click();
  await page
    .getByRole('textbox', { name: '分类名称', exact: true })
    .fill('宠物');
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  await page.getByRole('button', { name: '上移宠物', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored(page)).categories
          .filter((c: any) => c.kind === 'expense')
          .at(-2)?.label,
    )
    .toBe('宠物');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await startEntry(page, '32.50', '猫粮');
  await page.getByRole('button', { name: '分类宠物', exact: true }).click();
  await saveEntry(page);
  await settings(page, '分类管理');
  await page.getByRole('button', { name: '编辑分类宠物', exact: true }).click();
  await page
    .getByRole('textbox', { name: '分类名称', exact: true })
    .fill('毛孩子');
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  await page
    .getByRole('switch', { name: '显示分类毛孩子', exact: true })
    .uncheck();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: /猫粮.*查看详情/ }),
  ).toContainText('毛孩子');
  await startEntry(page, '5', '隐藏分类不会再预选');
  await expect(
    page.getByRole('button', { name: '分类毛孩子', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expect(page.getByText(/^毛孩子\s+100\.0%$/)).toBeVisible();
});

test('last-used category/account and named templates persist and prefill without silently recording', async ({
  page,
}) => {
  await page.goto('/');
  await startEntry(page, '18.50', '早餐店');
  await page.getByRole('button', { name: '分类咖啡茶饮', exact: true }).click();
  await page.getByRole('button', { name: '账户支付宝', exact: true }).click();
  await page.getByRole('switch', { name: '同时存为常用', exact: true }).check();
  await page
    .getByRole('textbox', { name: '常用名称', exact: true })
    .fill('早晨咖啡');
  await saveEntry(page);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '常用记账早晨咖啡', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('');
  expect((await stored(page)).defaults.expense).toEqual({
    categoryId: 'coffee',
    accountId: 'alipay',
  });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page
    .getByRole('button', { name: '常用记账早晨咖啡', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('18.50');
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('早餐店');
  expect((await stored(page)).entries).toHaveLength(1);
  await saveEntry(page);
  await expect(page.getByTestId('month-expense')).toHaveText('37.00');
  await settings(page, '常用记账');
  await page
    .getByRole('button', { name: '编辑常用早晨咖啡', exact: true })
    .click();
  await page.getByRole('textbox', { name: '常用金额', exact: true }).fill('20');
  await page.getByRole('button', { name: '保存常用项', exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).templates[0].amount)
    .toBe(2000);
  await page
    .getByRole('button', { name: '编辑常用早晨咖啡', exact: true })
    .click();
  await page.getByRole('button', { name: '删除常用项', exact: true }).click();
  await expect.poll(async () => (await stored(page)).templates.length).toBe(0);
  expect((await stored(page)).entries).toHaveLength(2);
});

test('linked refunds reduce original-month spending, credit the destination and protect their original', async ({
  page,
}) => {
  await page.goto('/');
  await startEntry(page, '100', '退款测试商品');
  await saveEntry(page);
  await page.getByRole('button', { name: /退款测试商品.*查看详情/ }).click();
  await page.getByRole('button', { name: '记录退款', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('101');
  await page.getByRole('button', { name: '确认退款', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '累计退款不能超过原支出金额',
  );
  expect((await stored(page)).entries).toHaveLength(1);
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('35');
  await page.getByRole('button', { name: '账户支付宝', exact: true }).click();
  await page.getByRole('button', { name: '确认退款', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('65.00');
  await expect(page.getByTestId('month-income')).toHaveText('0.00');
  const ledger = await stored(page);
  const refund = ledger.entries.find((entry: any) => entry.kind === 'refund');
  expect(refund.originalEntryId).toBe(
    ledger.entries.find((entry: any) => entry.kind === 'expense').id,
  );
  await settings(page);
  await expect(page.getByText('余额 ¥35.00', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份账本', exact: true }).click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(
    exported.entries.find((entry: any) => entry.kind === 'refund'),
  ).toEqual(refund);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page
    .getByRole('button', { name: /退款测试商品 支出 .*查看详情/ })
    .click();
  await page.getByRole('button', { name: '删除这笔账单', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '请先删除这笔支出的关联退款',
  );
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await page.getByRole('button', { name: '筛选退款', exact: true }).click();
  await page.getByRole('button', { name: /退款.*查看详情/ }).click();
  await page.getByRole('button', { name: '删除这笔账单', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('100.00');
});

test('annual view shows net totals, monthly trends and matching prior-year categories', async ({
  page,
}) => {
  const year = new Date().getFullYear();
  const ledger = emptyLedger();
  ledger.entries = [
    {
      id: 'a',
      kind: 'expense',
      amount: 12000,
      categoryId: 'food',
      accountId: 'wechat',
      date: `${year}-01-01`,
      note: '今年餐饮',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'b',
      kind: 'income',
      amount: 100000,
      categoryId: 'salary',
      accountId: 'bank',
      date: `${year}-01-02`,
      note: '工资',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'c',
      kind: 'expense',
      amount: 10000,
      categoryId: 'food',
      accountId: 'wechat',
      date: `${year - 1}-01-01`,
      note: '去年餐饮',
      createdAt: new Date().toISOString(),
    },
  ];
  await seed(page, ledger);
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await page.getByRole('button', { name: '按年统计', exact: true }).click();
  await expect(page.getByTestId('annual-expense')).toHaveText('¥120.00');
  await expect(page.getByTestId('annual-income')).toHaveText('1,000.00');
  await expect(page.getByTestId('annual-net')).toHaveText('880.00');
  await expect(page.getByTestId('annual-average')).toHaveText(
    (120 / (new Date().getMonth() + 1)).toFixed(2),
  );
  await expect(page.getByTestId('annual-trend-chart')).toHaveAttribute(
    'aria-label',
    new RegExp(`${year}年收支趋势`),
  );
  await expect(
    page.getByText('上年同期 ¥100.00', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('增加 20.0%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '上一年', exact: true }).click();
  await expect(page.getByTestId('annual-expense')).toHaveText('¥100.00');
  await page.screenshot({
    path: '/tmp/qingzhang-v020-annual.png',
    fullPage: true,
  });
});

test('hidden amounts persist across reload, include accessible chart labels and leave exports accurate', async ({
  page,
}) => {
  await page.goto('/');
  await startEntry(page, '123.45', '金额隐私测试');
  await saveEntry(page);
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('••••');
  await page.reload();
  await expect(page.getByTestId('month-expense')).toHaveText('••••');
  const row = page.getByRole('button', { name: /金额隐私测试.*查看详情/ });
  await expect(row).not.toHaveAttribute('aria-label', /123\.45/);
  await row.click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('123.45');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await settings(page, '隐私与备份提醒');
  await expect(
    page.getByRole('switch', { name: '应用锁', exact: true }),
  ).toBeDisabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '导出 JSON 备份', exact: true })
    .click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(exported.entries[0].amount).toBe(12345);
  expect(exported).not.toHaveProperty('appLockEnabled');
  expect(exported).not.toHaveProperty('hideAmounts');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expect(page.getByTestId('daily-expense-chart')).not.toHaveAttribute(
    'aria-label',
    /123\.45/,
  );
  await page.getByRole('button', { name: '按年统计', exact: true }).click();
  await expect(page.getByTestId('annual-expense')).toHaveText('¥••••');
  await expect(page.getByTestId('annual-trend-chart')).not.toHaveAttribute(
    'aria-label',
    /123\.45/,
  );
});

test('due backup reminders can be snoozed and a JSON export restarts their timer', async ({
  page,
}) => {
  const ledger = emptyLedger();
  ledger.entries = [
    {
      id: 'a',
      kind: 'expense',
      amount: 1500,
      categoryId: 'food',
      accountId: 'wechat',
      date: new Date().toISOString().slice(0, 10),
      note: '提醒测试',
      createdAt: new Date().toISOString(),
    },
  ];
  await seed(page, ledger, {
    ...defaultPreferences(),
    backupReminderDays: 7,
    reminderStartedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  });
  await expect(
    page.getByText('该导出一份备份了', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '明天提醒', exact: true }).click();
  await expect(page.getByText('该导出一份备份了', { exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByText('该导出一份备份了', { exact: true })).toHaveCount(
    0,
  );
  await settings(page, '隐私与备份提醒');
  await page.getByRole('button', { name: '每周提醒', exact: true }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '去备份', exact: true }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '导出 JSON 备份', exact: true })
    .click();
  await download;
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).lastExportAt,
        privacyKey,
      ),
    )
    .not.toBeNull();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByText('该导出一份备份了', { exact: true })).toHaveCount(
    0,
  );
});

test('v1 upgrades preserve the original file, and failed snapshot storage blocks the write', async ({
  page,
}) => {
  const source = {
    version: 1,
    monthlyBudget: 120000,
    showAccountCards: false,
    accounts: emptyLedger().accounts,
    entries: [],
  };
  await seed(page, source);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'qingzhang.ledger.legacy-v1')
        throw new Error('升级前备份无法保存');
      original.call(this, key, value);
    };
  });
  await startEntry(page, '20', '升级后的记录');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '升级前备份无法保存',
  );
  expect((await stored(page)).version).toBe(1);
  await page.reload();
  await startEntry(page, '20', '升级后的记录');
  await saveEntry(page);
  expect((await stored(page)).version).toBe(2);
  expect(
    JSON.parse(
      (await page.evaluate(() =>
        localStorage.getItem('qingzhang.ledger.legacy-v1'),
      ))!,
    ),
  ).toEqual(source);
  await settings(page);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '导出升级前备份', exact: true })
    .click();
  const legacy = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(legacy).toEqual(source);
});

test('privacy preference persistence failures are visible and do not hide saved figures', async ({
  page,
}) => {
  await page.goto('/');
  await startEntry(page, '11.20', '隐私设置写入失败');
  await saveEntry(page);
  await settings(page, '隐私与备份提醒');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('存储已满');
    };
  });
  await page.getByRole('switch', { name: '隐藏金额开关', exact: true }).click();
  await expect(page.getByTestId('privacy-error')).toContainText('存储已满');
  await expect(
    page.getByRole('switch', { name: '隐藏金额开关', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('11.20');
});

test('new settings stay usable on a narrow dark screen and standalone templates do not create transactions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await settings(page, '分类管理');
  await page.getByRole('button', { name: '新增分类', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '分类名称', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: '/tmp/qingzhang-v020-category-dark.png' });
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await page.getByRole('button', { name: '返回设置', exact: true }).click();
  await page.getByRole('button', { name: '常用记账', exact: true }).click();
  await page.getByRole('button', { name: '新增常用项', exact: true }).click();
  await page
    .getByRole('textbox', { name: '常用名称', exact: true })
    .fill('地铁通勤');
  await page.getByRole('textbox', { name: '常用金额', exact: true }).fill('4');
  await page.getByRole('button', { name: '常用分类交通', exact: true }).click();
  await page.getByRole('button', { name: '保存常用项', exact: true }).click();
  expect((await stored(page)).entries).toHaveLength(0);
  expect((await stored(page)).templates[0]).toMatchObject({
    name: '地铁通勤',
    categoryId: 'transport',
    amount: 400,
  });
  await page.getByRole('button', { name: '返回设置', exact: true }).click();
  await page
    .getByRole('button', { name: '隐私与备份提醒', exact: true })
    .click();
  await expect(
    page.getByRole('switch', { name: '应用锁', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '每月提醒', exact: true }).click();
  await page.screenshot({ path: '/tmp/qingzhang-v020-privacy-dark.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function record(page: Page, amount: string, note: string, kind = '支出') {
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  if (kind !== '支出')
    await page.getByRole('button', { name: `记${kind}`, exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill(amount);
  await page.getByRole('textbox', { name: '备注', exact: true }).fill(note);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
}

test('income, expenses, transfer, editing, deletion and reload form a working ledger', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('生活的记录，从这里开始')).toBeVisible();
  await record(page, '8000', '测试工资', '收入');
  await record(page, '28.50', '测试咖啡');
  await expect(page.getByTestId('month-expense')).toHaveText('28.50');
  await expect(page.getByTestId('month-income')).toHaveText('8,000.00');
  await record(page, '100', '账户间划转', '转账');
  await expect(page.getByTestId('month-expense')).toHaveText('28.50');
  await expect(page.getByTestId('month-net')).toHaveText('7,971.50');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!),
  );
  expect(saved.entries).toHaveLength(3);
  await page.reload();
  await expect(page.getByTestId('month-expense')).toHaveText('28.50');
  await page.getByRole('button', { name: /测试咖啡.*查看详情/ }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('35.20');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('35.20');
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索账单' }).fill('测试咖啡');
  await expect(
    page.getByRole('button', { name: /测试咖啡.*查看详情/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /测试工资.*查看详情/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: /测试咖啡.*查看详情/ }).click();
  await page.getByRole('button', { name: '删除这笔账单', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('没有找到这些账单')).toBeVisible();
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expect(page.getByText('你的消费画像，等待点亮')).toBeVisible();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('0.00');
  expect(errors).toEqual([]);
});

test('budget, account balances, sample data and JSON/CSV export', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开设置' }).click();
  await page.getByRole('textbox', { name: '月度预算金额' }).fill('3000');
  await page.getByRole('button', { name: '保存预算' }).click();
  await page.getByRole('button', { name: '编辑账户微信' }).click();
  await page.getByRole('textbox', { name: '初始余额' }).fill('500');
  await page.getByRole('button', { name: '保存账户' }).click();
  await expect(page.getByText('余额 ¥500.00')).toBeVisible();
  await page.getByRole('button', { name: '载入示例账本，看看效果' }).click();
  await page.getByRole('button', { name: '确认载入示例' }).click();
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份账本', exact: true }).click();
  const downloadedBackup = await backup;
  expect(downloadedBackup.suggestedFilename()).toMatch(/\.json$/);
  const backupContent = JSON.parse(
    await readFile((await downloadedBackup.path())!, 'utf8'),
  );
  expect(backupContent.entries).toHaveLength(9);
  expect(backupContent.version).toBe(2);
  const table = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出表格', exact: true }).click();
  const downloadedTable = await table;
  expect(downloadedTable.suggestedFilename()).toMatch(/\.csv$/);
  const tableContent = await readFile((await downloadedTable.path())!, 'utf8');
  expect(tableContent).toContain('"金额（元）"');
  expect(tableContent.split('\r\n')).toHaveLength(10);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('540.50');
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expect(page.getByText('支出分布', { exact: true })).toBeVisible();
  await expect(page.getByText(/^居家\s+36\.8%$/)).toBeVisible();
});

test('invalid entries and storage failure retain input and do not change saved totals', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText('请输入金额');
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('12.34');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('存储空间不足');
    };
  });
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText('存储空间不足');
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('12.34');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('0.00');
  expect(
    await page.evaluate(() => localStorage.getItem('qingzhang.ledger.v1')),
  ).toBeNull();
});

test('backup validation and explicit confirmation protect existing data', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '19.90', '保留记录');
  await page.getByRole('button', { name: '打开设置' }).click();
  const pick = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '恢复备份', exact: true }).click();
  await (
    await pick
  ).setFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByTestId('settings-error')).toContainText(
    '不支持此备份版本',
  );
  const existing = await page.evaluate(() =>
    localStorage.getItem('qingzhang.ledger.v1'),
  );
  const data = JSON.parse(existing!);
  data.entries[0].amount = 777;
  const nextPick = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '恢复备份', exact: true }).click();
  await (
    await nextPick
  ).setFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(
    page.getByRole('button', { name: '确认恢复备份' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('qingzhang.ledger.v1')),
  ).toBe(existing);
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('7.77');
});

test('editing a date moves a record to the correct month', async ({ page }) => {
  await page.goto('/');
  await record(page, '16.80', '跨月记录');
  await page.getByRole('button', { name: /跨月记录.*查看详情/ }).click();
  await page.getByRole('textbox', { name: '记账日期' }).fill('2026-02-28');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(
    page.getByTestId('page-home').getByText('2026 年 2 月', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('month-expense')).toHaveText('16.80');
  await page.getByRole('button', { name: '下个月', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('0.00');
});

test('corrupt local data is preserved and can be recovered from a valid backup', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '22.20', '备份中的记录');
  const backup = await page.evaluate(() =>
    localStorage.getItem('qingzhang.ledger.v1'),
  );
  await page.evaluate(() =>
    localStorage.setItem('qingzhang.ledger.v1', 'damaged-json'),
  );
  await page.reload();
  await expect(
    page.getByText('无法读取本地账本。请重试；原数据不会被覆盖。'),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('qingzhang.ledger.v1')),
  ).toBe('damaged-json');
  const pick = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: '从备份恢复账本', exact: true })
    .click();
  await (
    await pick
  ).setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup!),
  });
  await page.getByRole('button', { name: '确认恢复账本', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('22.20');
});

test('a narrow screen and dark mode keep navigation and entry controls usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await record(page, '9.90', '窄屏验证');
  await expect(page.getByTestId('month-expense')).toHaveText('9.90');
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expect(page.getByText('支出分布', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

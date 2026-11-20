import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  csv,
  emptyLedger,
  type Entry,
  type Ledger,
} from '../src/domain/ledger';

const key = 'qingzhang.ledger.v1';
const lunch: Entry = {
  id: 'lunch',
  kind: 'expense',
  date: '2026-11-05',
  amount: 6500,
  categoryId: 'food',
  accountId: 'wechat',
  note: '当月餐饮',
  createdAt: '2026-11-05T01:00:00Z',
};
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' });
const stored = (page: Page) =>
  page.evaluate(
    (ledgerKey) => JSON.parse(localStorage.getItem(ledgerKey)!),
    key,
  ) as Promise<Ledger>;
async function seed(page: Page, ledger: Ledger) {
  await page.clock.setFixedTime(new Date('2026-11-20T04:00:00Z'));
  await page.addInitScript(
    ({ key, ledger }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(ledger));
    },
    { key, ledger },
  );
  await page.goto('/');
}

test('batch category selection updates the linked refund in the same save', async ({
  page,
}) => {
  const refund: Entry = {
    ...lunch,
    id: 'refund',
    kind: 'refund',
    originalEntryId: 'lunch',
    amount: 100,
    note: '到账退款',
  };
  await seed(page, { ...emptyLedger(), entries: [lunch, refund] });
  await page.getByRole('tab', { name: '账单' }).click();
  await button(page, '批量分类').click();
  await button(page, /当月餐饮.*选择账单/).click();
  await expect(button(page, /到账退款.*选择账单/)).toBeDisabled();
  await button(page, '调整分类 · 1 笔').click();
  await button(page, '咖啡茶饮').click();
  await button(page, '确认修改分类').click();
  await expect
    .poll(async () =>
      (await stored(page)).entries.map((entry) => entry.categoryId),
    )
    .toEqual(['coffee', 'coffee']);
});

test('CSV import previews duplicates and invalid data before appending valid entries', async ({
  page,
}) => {
  const ledger = { ...emptyLedger(), entries: [lunch] };
  await seed(page, ledger);
  await button(page, '打开设置').click();
  await button(page, '导入 CSV').click();
  const chooser = page.waitForEvent('filechooser');
  await button(page, '选择 CSV').click();
  const input = csv(ledger, [
    lunch,
    { ...lunch, note: '导入的午餐' },
    { ...lunch, date: '2026-10-32' },
  ]);
  await (
    await chooser
  ).setFiles({
    name: 'book.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(input),
  });
  await expect(
    page.getByText('1 笔可导入 · 1 笔疑似重复 · 1 笔有问题'),
  ).toBeVisible();
  expect((await stored(page)).entries).toEqual([lunch]);
  await button(page, '确认导入有效账单').click();
  await expect(page.getByText('已导入 1 笔账单')).toBeVisible();
  expect((await stored(page)).entries.map((entry) => entry.note)).toEqual([
    '当月餐饮',
    '导入的午餐',
  ]);
});

test('monthly review links prior categories and a recurring category cap appears at home', async ({
  page,
}) => {
  const earlier = {
    ...lunch,
    id: 'earlier',
    date: '2026-10-19',
    note: '上月餐饮',
    amount: 2000,
  };
  await seed(page, {
    ...emptyLedger(),
    monthlyBudget: 100_000,
    entries: [lunch, earlier],
  });
  await button(page, '打开设置').click();
  await button(page, '设置分类预算').click();
  await button(page, '设置餐饮预算').click();
  await page.getByRole('textbox', { name: '分类预算金额' }).fill('70');
  await button(page, '保存分类预算').click();
  await expect
    .poll(async () => (await stored(page)).categoryBudgets)
    .toEqual([{ categoryId: 'food', amount: 7000 }]);
  expect((await stored(page)).monthlyBudget).toBe(100_000);
  await button(page, '关闭').click();
  await expect(page.getByText('¥65.00 / ¥70.00 · 接近上限')).toBeVisible();
  await page.getByRole('tab', { name: '统计' }).click();
  await expect(page.getByText('净支出较上月增加 ¥45.00')).toBeVisible();
  await button(page, '查看回顾中的上月餐饮').click();
  const entries = page.getByTestId('page-entries');
  await expect(entries.getByRole('button', { name: '选择月份' })).toHaveText(
    '2026 年 10 月',
  );
  await expect(
    entries.getByRole('button', { name: /上月餐饮.*查看详情/ }),
  ).toBeVisible();
  await expect(
    entries.getByRole('button', { name: /当月餐饮.*查看详情/ }),
  ).toHaveCount(0);
});

test('encrypted backups use distinct ciphertext, reject wrong passwords and preview before restore', async ({
  page,
}) => {
  test.setTimeout(80_000);
  await seed(page, { ...emptyLedger(), entries: [lunch] });
  await button(page, '打开设置').click();
  const password = '四月安全备份-Coffee-2026';
  const downloads: Buffer[] = [];
  for (let index = 0; index < 2; index++) {
    await button(page, '导出加密备份').click();
    await page.getByLabel('备份密码', { exact: true }).fill(password);
    await page.getByLabel('再次输入备份密码', { exact: true }).fill(password);
    const downloading = page.waitForEvent('download');
    await button(page, '加密并导出').click();
    const file = await downloading;
    expect(file.suggestedFilename()).toMatch(/\.encrypted\.json$/);
    downloads.push(await readFile((await file.path())!));
  }
  expect(downloads[0]!.toString()).not.toContain(lunch.note);
  expect(downloads[0]!.equals(downloads[1]!)).toBe(false);
  const chooser = page.waitForEvent('filechooser');
  await button(page, '恢复备份').click();
  await (
    await chooser
  ).setFiles({
    name: 'backup.encrypted.json',
    mimeType: 'application/json',
    buffer: downloads[0]!,
  });
  await page.getByLabel('备份密码', { exact: true }).fill('wrong-password-123');
  await button(page, '解锁并预览').click();
  await expect(page.getByText('密码不正确或加密备份已损坏')).toBeVisible({
    timeout: 20_000,
  });
  expect((await stored(page)).entries).toEqual([lunch]);
  await page.getByLabel('备份密码', { exact: true }).fill(password);
  await button(page, '解锁并预览').click();
  await expect(button(page, '确认恢复备份')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('账单日期 2026-11-05')).toBeVisible();
  await button(page, '确认恢复备份').click();
  await expect(button(page, '确认恢复备份')).toHaveCount(0);
  expect((await stored(page)).entries).toEqual([lunch]);
});

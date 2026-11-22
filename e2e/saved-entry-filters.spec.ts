import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { emptyLedger, type Entry } from '../src/domain/ledger';

test('saved filters survive reload, move relative dates and export the new result', async ({
  page,
}) => {
  const first: Entry = {
    id: 'first',
    kind: 'expense',
    accountId: 'wechat',
    categoryId: 'food',
    amount: 500,
    date: '2026-12-22',
    note: '十二月报销',
    createdAt: '2026-12-22T04:00:00Z',
  };
  const ledger = {
    ...emptyLedger(),
    entries: [
      first,
      { ...first, id: 'second', date: '2027-01-08', note: '一月报销' },
      { ...first, id: 'other', date: '2027-01-09', note: '普通午饭' },
    ],
  };
  await page.clock.setFixedTime(new Date('2027-01-03T04:00:00Z'));
  await page.addInitScript((data) => {
    if (localStorage.getItem('qingzhang.ledger.v1') === null)
      localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(data));
  }, ledger);
  await page.goto('/');
  const bills = page.getByRole('tab', { name: '账单', exact: true });
  const openSaved = page.getByRole('button', { name: '常用筛选', exact: true });
  const applySaved = page.getByRole('button', {
    name: '应用上月报销',
    exact: true,
  });
  const query = page.getByRole('textbox', { name: '搜索账单', exact: true });
  const summary = page.getByTestId('active-entry-filters');
  await bills.click();
  await page.getByRole('button', { name: '筛选支出', exact: true }).click();
  await page.getByRole('button', { name: '打开组合筛选', exact: true }).click();
  await page.getByRole('button', { name: '上月', exact: true }).click();
  await page.getByRole('button', { name: '筛选账户微信', exact: true }).click();
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await query.fill('报销');
  await expect(summary).toHaveText('2026-12-01 至 2026-12-31 · 微信 · 1 笔');
  await openSaved.click();
  const name = page.getByRole('textbox', { name: '筛选名称', exact: true });
  await name.fill('上月报销');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'qingzhang.saved-entry-filters.v1') {
        Storage.prototype.setItem = original;
        throw new Error('模拟写入失败');
      }
      original.call(this, key, value);
    };
  });
  const save = page.getByRole('button', { name: '保存筛选', exact: true });
  await save.click();
  await expect(page.getByText('无法保存常用筛选，请重试')).toBeVisible();
  await expect(name).toHaveValue('上月报销');
  await expect(applySaved).toHaveCount(0);
  await save.click();
  await expect(applySaved).toBeVisible();

  await page.clock.setFixedTime(new Date('2027-02-03T04:00:00Z'));
  await page.reload();
  await bills.click();
  await openSaved.click();
  await applySaved.click();
  await expect(query).toHaveValue('报销');
  await expect(summary).toHaveText('2027-01-01 至 2027-01-31 · 微信 · 1 笔');
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '导出筛选结果 CSV', exact: true })
    .click();
  const download = await downloading;
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv).toContain('一月报销');
  expect(csv).not.toContain('十二月报销');
  expect(csv).not.toContain('普通午饭');

  await openSaved.click();
  await page.getByRole('button', { name: '移除上月报销', exact: true }).click();
  await expect(page.getByText('还没有保存的筛选')).toBeVisible();
  const savedLedger = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!),
  );
  expect(savedLedger.entries).toEqual(ledger.entries);
});

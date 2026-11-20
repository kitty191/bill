import { expect, test, type Page } from '@playwright/test';
import { emptyLedger, type Entry, type Ledger } from '../src/domain/ledger';

const key = 'qingzhang.ledger.v1';
const historical: Entry = {
  id: 'old-card', kind: 'expense', accountId: 'bank', categoryId: 'food',
  amount: 2500, date: '2026-11-18', createdAt: '2026-11-18T00:00:00Z',
  note: '旧银行卡账单',
};
const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const load = (page: Page): Promise<Ledger> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);

async function seed(page: Page, ledger: Ledger) {
  await page.clock.setFixedTime(new Date('2026-11-18T04:00:00Z'));
  await page.addInitScript(({ key, ledger }) => {
    if (localStorage.getItem(key) === null)
      localStorage.setItem(key, JSON.stringify(ledger));
  }, { key, ledger });
  await page.goto('/');
}

test('archives and restores a card while retaining its balance and historical edits', async ({ page }) => {
  const ledger = {
    ...emptyLedger(), showAccountCards: true, entries: [historical],
    defaults: { expense: { accountId: 'bank', categoryId: 'food' } },
  };
  ledger.accounts.find((account) => account.id === 'bank')!.openingBalance = 30000;
  await seed(page, ledger);
  await expect(button(page, '查看银行卡账户明细')).toBeVisible();
  await button(page, '打开设置').click();
  await button(page, '编辑账户银行卡').click();
  const archive = page.getByRole('switch', { name: '归档此账户', exact: true });
  await archive.check();
  await button(page, '保存账户').click();
  await expect(page.getByText('银行卡 · 已归档', { exact: true })).toBeVisible();
  await expect(page.getByText('余额 ¥275.00', { exact: true })).toBeVisible();
  await button(page, '关闭').click();
  await page.reload();

  await expect(button(page, '查看银行卡账户明细')).toHaveCount(0);
  await expect(button(page, '总资产 ¥275.00')).toBeVisible();
  await button(page, '记一笔').click();
  await expect(button(page, '账户银行卡')).toHaveCount(0);
  await button(page, '记转账').click();
  await expect(button(page, '转入银行卡')).toHaveCount(0);
  await button(page, '关闭').click();

  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await button(page, '打开组合筛选').click();
  await button(page, '筛选账户银行卡').click();
  await button(page, '应用筛选').click();
  await page.getByRole('button', { name: /旧银行卡账单.*查看详情/ }).click();
  await expect(button(page, '账户银行卡')).toContainText('已归档');
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('补充历史备注');
  await button(page, '保存修改').click();
  await expect.poll(async () => (await load(page)).entries[0]?.note).toBe('补充历史备注');
  expect((await load(page)).entries[0]?.accountId).toBe('bank');

  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await button(page, '打开设置').click();
  await button(page, '编辑账户银行卡').click();
  await archive.uncheck();
  await button(page, '保存账户').click();
  await expect(archive).toHaveCount(0);
  await button(page, '关闭').click();
  await expect(button(page, '查看银行卡账户明细')).toBeVisible();
  await button(page, '记一笔').click();
  await expect(button(page, '账户银行卡')).toBeVisible();
});

test('requires an explicit replacement account when repeating an archived card payment', async ({ page }) => {
  const ledger = emptyLedger();
  ledger.accounts.find((account) => account.id === 'bank')!.archived = true;
  ledger.entries = [historical];
  await seed(page, ledger);

  await page.getByRole('button', { name: /旧银行卡账单.*查看详情/ }).click();
  await button(page, '再记一笔').click();
  await expect(button(page, '账户银行卡')).toHaveCount(0);
  await button(page, '记好了').click();
  await expect(page.getByTestId('entry-error')).toContainText('所选账户已归档');
  expect((await load(page)).entries).toHaveLength(1);
  await button(page, '账户微信').click();
  await button(page, '记好了').click();
  await expect.poll(async () => (await load(page)).entries).toEqual([
    historical,
    expect.objectContaining({ accountId: 'wechat', amount: historical.amount }),
  ]);
});

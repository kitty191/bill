import { test, expect } from '@playwright/test';

test('account cards are optional, survive reload, and keep the ledger intact', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('生活的记录，从这里开始')).toBeVisible();
  await expect(page.getByTestId('account-carousel')).toHaveCount(0);
  await page.getByRole('button', { name: '打开设置' }).click();
  const toggle = page.getByRole('switch', { name: '首页显示账户卡片' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!)
            ?.showAccountCards,
      ),
    )
    .toBe(true);
  // Loading sample records must preserve the user's display choice.
  await page.getByRole('button', { name: '载入示例账本，看看效果' }).click();
  await page.getByRole('button', { name: '确认载入示例' }).click();
  await expect(toggle).toBeEnabled();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByTestId('account-carousel').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: '管理微信账户', exact: true }),
  ).toBeVisible();
  const ledger = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!),
  );
  expect(ledger.entries).toHaveLength(9);
  expect(ledger.accounts).toHaveLength(4);
  await page.reload();
  await expect(page.getByTestId('account-carousel')).toHaveCount(1);
  await page.getByRole('button', { name: '打开设置' }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!)
            ?.showAccountCards,
      ),
    )
    .toBe(false);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('account-carousel')).toHaveCount(0);
  await expect(
    page.getByTestId('page-home').getByText('我的账户', { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('month-expense')).toHaveText('540.50');
  await expect(page.getByTestId('account-carousel')).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!),
  );
  expect(saved).toEqual({ ...ledger, showAccountCards: false });
  // Continue recording while cards are hidden.
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('10');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('550.50');
});

test('a failed display-setting save leaves the switch and ledger unchanged', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开设置' }).click();
  const toggle = page.getByRole('switch', { name: '首页显示账户卡片' });
  await toggle.check();
  await expect(toggle).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!)
            ?.showAccountCards,
      ),
    )
    .toBe(true);
  const saved = await page.evaluate(() =>
    localStorage.getItem('qingzhang.ledger.v1'),
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('存储空间不足');
    };
  });
  // Native switches are controlled: the persisted value must remain on.
  await toggle.click();
  await expect(page.getByTestId('settings-error')).toContainText(
    '存储空间不足',
  );
  await expect(toggle).toBeChecked();
  expect(
    await page.evaluate(() => localStorage.getItem('qingzhang.ledger.v1')),
  ).toBe(saved);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('account-carousel')).toHaveCount(1);
});

test('repeated account-display taps keep settings interactive and persist the last choice after closing', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开设置' }).click();
  const toggle = page.getByRole('switch', { name: '首页显示账户卡片' });
  const close = page.getByRole('button', { name: '关闭', exact: true });
  const budget = page.getByRole('button', { name: '保存预算', exact: true });
  const start = await toggle.boundingBox();
  for (let i = 0; i < 7; i++) {
    await toggle.click();
    await expect(toggle).toBeEnabled();
    await expect(close).toBeEnabled();
    await expect(budget).toBeEnabled();
    const current = await toggle.boundingBox();
    expect(Math.abs(current!.y - start!.y)).toBeLessThan(2);
  }
  await expect(toggle).toBeChecked();
  await close.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!)
            ?.showAccountCards,
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByTestId('account-carousel')).toBeVisible();
});

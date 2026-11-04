import { test, expect } from '@playwright/test';
import { emptyLedger, type Entry } from '../src/domain/ledger';

test('10000 entries render on demand, retain complete totals and remain editable at the end of the list', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  const ledger = emptyLedger();
  ledger.entries = Array.from(
    { length: 10000 },
    (_, index): Entry => ({
      id: `large-${index}`,
      kind: 'expense',
      amount: 100,
      categoryId: 'food',
      accountId: 'wechat',
      date: `2026-11-${String((index % 28) + 1).padStart(2, '0')}`,
      note: `大账本-${index}`,
      createdAt: new Date(
        Date.UTC(2026, 10, 28, 12) - index * 1000,
      ).toISOString(),
    }),
  );
  await page.addInitScript((ledger) => {
    if (!localStorage.getItem('qingzhang.ledger.v1'))
      localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(ledger));
  }, ledger);
  await page.goto('/');
  await expect(page.getByTestId('month-expense')).toHaveText('10,000.00');
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  const bills = page.getByTestId('page-entries');
  const rows = bills.getByRole('button', { name: /查看详情$/ });
  await expect(
    bills.getByRole('button', { name: /大账本-27 .*查看详情/ }),
  ).toBeVisible();
  expect(await rows.count()).toBeLessThan(250);
  const query = page.getByRole('textbox', { name: '搜索账单', exact: true });
  await query.fill('大账本-9999');
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId('active-entry-filters')).toContainText('1 笔');
  await expect(bills.getByText('¥1.00', { exact: true })).toBeVisible();
  await query.fill('不存在');
  await expect(
    bills.getByText('没有找到这些账单', { exact: true }),
  ).toBeVisible();
  await query.fill('');
  await expect(
    bills.getByRole('button', { name: /大账本-27 .*查看详情/ }),
  ).toBeVisible();
  const scroller = page.getByTestId('page-entries-scroll');
  await expect
    .poll(
      async () => {
        await scroller.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        return bills
          .getByRole('button', { name: /大账本-9996 .*查看详情/ })
          .isVisible();
      },
      { timeout: 45000, intervals: [50] },
    )
    .toBe(true);
  expect(await rows.count()).toBeLessThan(250);
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await expect(
    bills.getByRole('button', { name: /大账本-9996 .*查看详情/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(async () => {
      await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      return bills
        .getByRole('button', { name: /大账本-9996 .*查看详情/ })
        .isVisible();
    })
    .toBe(true);
  await page.screenshot({ path: '/tmp/qingzhang-v041-large-deep-dark.png' });
  await bills.getByRole('button', { name: /大账本-9996 .*查看详情/ }).click();
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('大账本-9996');
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('2');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('10,001.00');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!),
  );
  expect(saved.entries).toHaveLength(10000);
  expect(
    saved.entries.find((entry: Entry) => entry.id === 'large-9996').amount,
  ).toBe(200);
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('button', { name: '查看全部', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '搜索账单', exact: true }),
  ).toBeInViewport();
  await expect(
    bills.getByRole('button', { name: /大账本-27 .*查看详情/ }),
  ).toBeVisible();
  await expect(page.getByText('账单已更新', { exact: true })).not.toBeVisible({
    timeout: 10000,
  });
  await page.screenshot({ path: '/tmp/qingzhang-v041-large-ledger.png' });
});

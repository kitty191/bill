import { test, expect, type Page } from '@playwright/test';
import { emptyLedger, type Entry } from '../src/domain/ledger';

const original: Entry = {
  id: 'review',
  kind: 'expense',
  amount: 999999999,
  categoryId: 'food',
  accountId: 'alipay',
  date: '2026-11-04',
  note: '整体审查',
  createdAt: '2026-11-04T04:00:00.000Z',
};
async function seed(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await page.addInitScript(
    (ledger) => {
      if (localStorage.getItem('qingzhang.ledger.v1') === null)
        localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(ledger));
    },
    { ...emptyLedger(), entries: [original] },
  );
  await page.goto('/');
}
async function expectReadable(page: Page, id: string) {
  // setViewportSize completes before RN Web's onLayout updates the page's
  // explicit width. Check the actual new layout before comparing font sizes.
  await expect
    .poll(async () => {
      const screen = await page.getByTestId('page-home').boundingBox();
      const pager = await page.getByTestId('page-pager').boundingBox();
      return Math.abs(screen!.width - pager!.width);
    })
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      page.getByTestId(id).evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let width = 0;
        while (walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          width += range.getBoundingClientRect().width;
        }
        return width - element.getBoundingClientRect().width;
      }),
    )
    .toBeLessThanOrEqual(0);
}

test('large amounts remain fully readable on narrow screens, after resize and privacy toggles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page);
  await expect(page.getByTestId('month-expense')).toHaveText('9,999,999.99');
  await expectReadable(page, 'month-expense');
  await expectReadable(page, 'today-expense');
  await expectReadable(page, 'month-net');
  await page.setViewportSize({ width: 430, height: 844 });
  await expectReadable(page, 'month-expense');
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('••••');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: '显示金额', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('9,999,999.99');
  await expectReadable(page, 'month-expense');
  await expectReadable(page, 'today-expense');
  await expectReadable(page, 'month-net');
  const font = await page
    .getByTestId('month-expense')
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
  expect(font).toBeGreaterThan(26);
  await page.waitForTimeout(500);
  await expectReadable(page, 'month-expense');
  await expectReadable(page, 'today-expense');
  await expectReadable(page, 'month-net');
  const settledFont = await page
    .getByTestId('month-expense')
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
  expect(settledFont).toBeCloseTo(font, 1);
  await page.screenshot({ path: '/tmp/qingzhang-v051-large-money.png' });
});

test('changing an existing expense into a transfer starts with a distinct destination account', async ({
  page,
}) => {
  await seed(page);
  await page
    .getByTestId('page-home')
    .getByRole('button', { name: /整体审查.*查看详情/ })
    .click();
  await page.getByRole('button', { name: '记转账', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
  const ledger = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!),
  );
  expect(ledger.entries).toHaveLength(1);
  expect(ledger.entries[0]).toMatchObject({
    id: original.id,
    kind: 'transfer',
    amount: original.amount,
    accountId: 'alipay',
    toAccountId: 'wechat',
  });
  await expect(page.getByTestId('month-expense')).toHaveText('0.00');
  await expect(page.getByTestId('month-income')).toHaveText('0.00');
});

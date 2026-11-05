import { test, expect, type Page } from '@playwright/test';
import { emptyLedger } from '../src/domain/ledger';

test.use({ hasTouch: true });
async function open(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await page.addInitScript(
    (ledger) =>
      localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(ledger)),
    {
      ...emptyLedger(),
      entries: [
        {
          id: 'chart',
          kind: 'expense',
          amount: 123456,
          date: '2026-11-04',
          createdAt: '2026-11-04T04:00:00.000Z',
          note: '交互验收',
          accountId: 'wechat',
          categoryId: 'food',
        },
      ],
    },
  );
  await page.goto('/');
}
test('chart vertical scrolling retains priority, and annual exploration clamps to observed months', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  const chart = page.getByTestId('daily-expense-chart');
  await chart.scrollIntoViewIfNeeded();
  const before = await page
    .getByTestId('page-stats-scroll')
    .evaluate((element) => element.scrollTop);
  const box = (await chart.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + 40;
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (const dy of [20, 40, 70, 100, 125]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + dy }],
    });
    await page.waitForTimeout(20);
  }
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() =>
      page
        .getByTestId('page-stats-scroll')
        .evaluate((element) => element.scrollTop),
    )
    .toBeLessThan(before - 5);
  await expect(
    page.getByRole('tab', { name: '统计', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '按年统计', exact: true }).click();
  const annual = page.getByTestId('annual-trend-chart');
  await annual.scrollIntoViewIfNeeded();
  const area = (await annual.boundingBox())!;
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: area.x + 44, y: area.y + 90 }],
  });
  for (const fraction of [0.2, 0.4, 0.7, 1]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: area.x + 44 + (area.width - 54) * fraction, y: area.y + 90 },
      ],
    });
    await page.waitForTimeout(20);
  }
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByTestId('annual-month-detail')).toContainText('11月');
  await expect(annual).toHaveAttribute('aria-valuenow', '11');
  await annual.focus();
  await page.keyboard.press('Home');
  await expect(annual).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('End');
  await expect(annual).toHaveAttribute('aria-valuenow', '11');
  await touch.detach();
});

test('narrow dark quick actions respect hidden amounts while repeat retains the exact draft value', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('••••');
  await page.getByTestId('page-home-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const row = page
    .getByTestId('page-home')
    .getByRole('button', { name: /交互验收.*查看详情/ });
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(page.getByText('账单快捷操作', { exact: true })).toBeVisible();
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  const repeat = page.getByRole('button', { name: '再记一笔', exact: true });
  await expect(repeat).toBeVisible();
  const body = repeat.locator('..');
  await expect(body).toContainText('••••');
  await expect(body).not.toContainText('1,234.56');
  await page.screenshot({
    path: '/tmp/qingzhang-v050-actions-private-dark.png',
  });
  await repeat.click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('1234.56');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!).entries.length,
    ),
  ).toBe(1);
});

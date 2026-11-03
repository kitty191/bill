import { test, expect, type Page } from '@playwright/test';

test.use({ hasTouch: true });

async function swipe(page: Page, x: number, y: number, dx: number, dy = 0) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 12, y: y + (dy * i) / 12 }],
    });
    await page.waitForTimeout(18);
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
}

async function expectPage(page: Page, key: string, label: string) {
  await expect(
    page.getByRole('tab', { name: label, exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(async () =>
      Math.abs((await page.getByTestId(`page-${key}`).boundingBox())!.x - 1),
    )
    .toBeLessThan(3);
}

test('right swipes advance through pages, left swipes return, and tabs remain synchronized', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expectPage(page, 'home', '首页');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('12.34');
  await page
    .getByRole('textbox', { name: '备注', exact: true })
    .fill('手势测试');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
  await swipe(page, 65, 300, 250);
  await expectPage(page, 'entries', '账单');
  const row = (await page
    .getByRole('button', { name: /手势测试.*查看详情/ })
    .boundingBox())!;
  await swipe(page, row.x + 32, row.y + row.height / 2, 250);
  await expectPage(page, 'stats', '统计');
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 430, height: 844 });
  await expectPage(page, 'stats', '统计');
  await swipe(page, 315, 310, -250);
  await expectPage(page, 'entries', '账单');
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expectPage(page, 'home', '首页');
  await swipe(page, 315, 310, -250);
  await expectPage(page, 'home', '首页');
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expectPage(page, 'stats', '统计');
  await swipe(page, 65, 310, 250);
  await expectPage(page, 'stats', '统计');
  expect(errors).toEqual([]);
});

test('rightward finger movement moves the page and dock highlight right together without mirroring', async ({
  page,
}) => {
  await page.goto('/');
  await expectPage(page, 'home', '首页');
  const pager = page.getByTestId('page-pager');
  const arrangement = await pager.evaluate((element) => ({
    order: [...element.querySelectorAll('[data-testid]')]
      .map((page) => page.getAttribute('data-testid'))
      .filter((id) => /^page-(home|entries|stats)$/.test(id!)),
    direction: getComputedStyle(element).direction,
    offset: element.scrollLeft,
    pageTransform: getComputedStyle(
      element.querySelector('[data-testid="page-home"]')!,
    ).transform,
  }));
  expect(arrangement.order).toEqual([
    'page-stats',
    'page-entries',
    'page-home',
  ]);
  expect(arrangement.direction).toBe('ltr');
  expect(arrangement.pageTransform).toBe('none');
  expect(arrangement.offset).toBeGreaterThan(700);
  const indicator = page.getByTestId('dock-indicator');
  const initialX = (await indicator.boundingBox())!.x;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 65, y: 300 }],
    });
    for (const x of [95, 125, 155, 185]) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: 300 }],
      });
      await page.waitForTimeout(20);
    }
    await expect
      .poll(async () => (await page.getByTestId('page-home').boundingBox())!.x)
      .toBeGreaterThan(30);
    await expect
      .poll(async () => (await indicator.boundingBox())!.x)
      .toBeGreaterThan(initialX + 5);
    expect(await pager.evaluate((element) => element.scrollLeft)).toBeLessThan(
      arrangement.offset,
    );
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 315, y: 300 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expectPage(page, 'entries', '账单');
  } finally {
    await session.detach();
  }
});

test('vertical scrolling and horizontal account scrolling keep priority over page swipes', async ({
  page,
}) => {
  await page.goto('/');
  await expectPage(page, 'home', '首页');
  await page.getByRole('button', { name: '打开设置' }).click();
  await page.getByRole('switch', { name: '首页显示账户卡片' }).check();
  await expect(
    page.getByRole('switch', { name: '首页显示账户卡片' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await swipe(page, 200, 520, 0, -240);
  await expect
    .poll(() =>
      page
        .getByTestId('page-home-scroll')
        .evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(80);
  await expectPage(page, 'home', '首页');
  await page.getByTestId('account-carousel').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('account-carousel').boundingBox())!;
  await swipe(page, box.x + box.width - 35, box.y + box.height / 2, -220);
  await expect
    .poll(() =>
      page
        .getByTestId('account-carousel')
        .evaluate((element) => element.scrollLeft),
    )
    .toBeGreaterThan(40);
  await expectPage(page, 'home', '首页');
  await swipe(page, box.x + 35, box.y + box.height / 2, 220);
  await expectPage(page, 'home', '首页');
});

test('the daily line chart sums the same day, shows zero days and exposes tap details', async ({
  page,
}) => {
  await page.goto('/');
  for (const record of [
    { amount: '10', date: '2026-10-01' },
    { amount: '5.50', date: '2026-10-01' },
    { amount: '30', date: '2026-10-08' },
  ]) {
    await page.getByRole('button', { name: '记一笔', exact: true }).click();
    await page
      .getByRole('textbox', { name: '金额', exact: true })
      .fill(record.amount);
    await page.getByRole('textbox', { name: '记账日期' }).fill(record.date);
    await page.getByRole('button', { name: '记好了', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: '金额', exact: true }),
    ).not.toBeVisible();
  }
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  await expectPage(page, 'stats', '统计');
  const chart = page.getByTestId('daily-expense-chart');
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toHaveAttribute(
    'aria-label',
    /每日支出折线图，最高 30.00 元/,
  );
  const box = (await chart.boundingBox())!;
  await chart.click({ position: { x: 44, y: 85 } });
  await expect(page.getByTestId('daily-expense-selection')).toHaveText(
    '10月1日 · 支出 ¥15.50',
  );
  await chart.click({
    position: { x: 44 + ((box.width - 54) * 14) / 30, y: 85 },
  });
  await expect(page.getByTestId('daily-expense-selection')).toHaveText(
    '10月15日 · 支出 ¥0.00',
  );
  const path = await chart.locator('svg path[fill="none"]').getAttribute('d');
  expect(path?.match(/L/g)).toHaveLength(30);
  await page.getByRole('button', { name: '下个月', exact: true }).click();
  await expect(page.getByTestId('daily-expense-selection')).toHaveText(
    '本月暂无支出记录',
  );
});

test('swiping retains bill filters while View all opens the unfiltered ledger', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('18.30');
  await page
    .getByRole('textbox', { name: '备注', exact: true })
    .fill('筛选回归记录');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await expectPage(page, 'entries', '账单');
  await page.getByRole('textbox', { name: '搜索账单' }).fill('不存在的内容');
  await expect(
    page.getByTestId('page-entries').getByText('没有找到这些账单'),
  ).toBeVisible();
  await swipe(page, 65, 300, 250);
  await expectPage(page, 'stats', '统计');
  await swipe(page, 315, 300, -250);
  await expectPage(page, 'entries', '账单');
  await expect(page.getByRole('textbox', { name: '搜索账单' })).toHaveValue(
    '不存在的内容',
  );
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expectPage(page, 'home', '首页');
  await page.getByTestId('page-home-scroll').evaluate((element) => {
    element.scrollTop = 220;
  });
  await page.getByRole('button', { name: '查看全部', exact: true }).click();
  await expectPage(page, 'entries', '账单');
  await expect(page.getByRole('textbox', { name: '搜索账单' })).toHaveValue('');
  await expect(
    page.getByRole('button', { name: /筛选回归记录.*查看详情/ }),
  ).toBeVisible();
});

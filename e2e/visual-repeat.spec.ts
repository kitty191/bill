import { test, expect, type Locator, type Page } from '@playwright/test';
import { emptyLedger, type Entry, type Ledger } from '../src/domain/ledger';

test.use({ hasTouch: true });
const key = 'qingzhang.ledger.v1';
const original: Entry = {
  id: 'original',
  kind: 'expense',
  amount: 1000,
  accountId: 'wechat',
  categoryId: 'food',
  date: '2026-11-02',
  createdAt: '2026-11-02T04:00:00.000Z',
  note: '早餐样例',
};
async function seed(page: Page, entries: Entry[]) {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await page.addInitScript(
    ({ ledger, key }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(ledger));
    },
    { ledger: { ...emptyLedger(), entries }, key },
  );
  await page.goto('/');
}
async function saved(page: Page): Promise<Ledger> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function longPress(page: Page, row: Locator) {
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  await expect(page.getByText('账单快捷操作', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveCount(0);
}

test('long press and detail repeat prefill today without writes, preserve the source and omit recurring identity', async ({
  page,
}) => {
  const source = {
    ...original,
    recurringId: 'deleted-rule',
    recurringDate: original.date,
  };
  await seed(page, [source]);
  const before = await saved(page);
  await longPress(
    page,
    page
      .getByTestId('page-home')
      .getByRole('button', { name: /早餐样例.*查看详情/ }),
  );
  await page.screenshot({ path: '/tmp/qingzhang-v050-actions-light.png' });
  await page.getByRole('button', { name: '再记一笔', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('10.00');
  await expect(
    page.getByRole('textbox', { name: '记账日期', exact: true }),
  ).toHaveValue('2026-11-04');
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue(source.note);
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await page.getByRole('button', { name: /早餐样例.*查看详情/ }).click();
  await page.getByRole('button', { name: '再记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('12.50');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
  const next = await saved(page);
  expect(next.entries).toHaveLength(2);
  expect(next.entries.find((entry) => entry.id === source.id)).toEqual(source);
  const copy = next.entries.find((entry) => entry.id !== source.id)!;
  expect(copy).toMatchObject({
    kind: 'expense',
    amount: 1250,
    categoryId: source.categoryId,
    accountId: source.accountId,
    date: '2026-11-04',
    note: source.note,
  });
  expect(copy.createdAt).not.toBe(source.createdAt);
  expect(copy.recurringId).toBeUndefined();
  expect(copy.recurringDate).toBeUndefined();
  await page.reload();
  await expect(page.getByTestId('today-expense')).toHaveText('¥12.50');
  expect((await saved(page)).entries).toEqual(next.entries);
  await page.screenshot({ path: '/tmp/qingzhang-v050-home-light.png' });
});

for (const kind of ['income', 'transfer'] as const) {
  test(`repeating ${kind} preserves accounts and financial type without changing the original`, async ({
    page,
  }) => {
    const source: Entry = {
      ...original,
      kind,
      categoryId: kind === 'transfer' ? 'transfer' : 'salary',
      ...(kind === 'transfer' ? { toAccountId: 'alipay' } : {}),
      note: `${kind}样例`,
    };
    await seed(page, [source]);
    await longPress(
      page,
      page
        .getByTestId('page-home')
        .getByRole('button', { name: new RegExp(`${kind}样例.*查看详情`) }),
    );
    await page.getByRole('button', { name: '再记一笔', exact: true }).click();
    await page.getByRole('button', { name: '记好了', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: '金额', exact: true }),
    ).not.toBeVisible();
    const next = await saved(page);
    expect(next.entries).toHaveLength(2);
    expect(next.entries.find((entry) => entry.id === source.id)).toEqual(
      source,
    );
    expect(next.entries.find((entry) => entry.id !== source.id)).toMatchObject({
      kind,
      categoryId: source.categoryId,
      accountId: source.accountId,
      ...(source.toAccountId ? { toAccountId: source.toAccountId } : {}),
      amount: 1000,
      date: '2026-11-04',
    });
    await expect(page.getByTestId('month-expense')).toHaveText('0.00');
    await expect(page.getByTestId('month-income')).toHaveText(
      kind === 'income' ? '20.00' : '0.00',
    );
  });
}

test('repeating a refund retains its original link and refuses to exceed the remaining refundable amount', async ({
  page,
}) => {
  const refund: Entry = {
    ...original,
    id: 'refund',
    kind: 'refund',
    amount: 600,
    originalEntryId: original.id,
    date: '2026-11-03',
    note: '退款样例',
  };
  await seed(page, [original, refund]);
  await page
    .getByTestId('page-home')
    .getByRole('button', { name: /退款样例.*查看详情/ })
    .click();
  await page.getByRole('button', { name: '再记一笔', exact: true }).click();
  await page.getByRole('button', { name: '确认退款', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '累计退款不能超过原支出金额',
  );
  expect((await saved(page)).entries).toHaveLength(2);
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('4');
  await page.getByRole('button', { name: '确认退款', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
  const next = await saved(page);
  expect(next.entries).toHaveLength(3);
  expect(
    next.entries.find((entry) => ![original.id, refund.id].includes(entry.id)),
  ).toMatchObject({
    kind: 'refund',
    originalEntryId: original.id,
    amount: 400,
    date: '2026-11-04',
  });
  await expect(page.getByTestId('month-expense')).toHaveText('0.00');
});

test('repeat save failures retain the draft and original ledger, and editing first prevents silently discarding changes', async ({
  page,
}) => {
  await seed(page, [original]);
  await page
    .getByTestId('page-home')
    .getByRole('button', { name: /早餐样例.*查看详情/ })
    .click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('11');
  await page.getByRole('button', { name: '再记一笔', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '请先保存原账单的修改',
  );
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('10.00');
  await page.getByRole('button', { name: '再记一笔', exact: true }).click();
  await page.evaluate((key) => {
    const save = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (k, value) {
      if (k === key && fail) {
        fail = false;
        throw new Error('模拟复制保存失败');
      }
      return save.call(this, k, value);
    };
  }, key);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '模拟复制保存失败',
  );
  expect((await saved(page)).entries).toEqual([original]);
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('10.00');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
  expect((await saved(page)).entries).toHaveLength(2);
});

test('charts support horizontal dragging, cancellation, keyboard exploration and private tooltips within the viewport', async ({
  page,
}) => {
  await seed(page, [
    { ...original, date: '2026-11-01' },
    { ...original, id: 'fourth', amount: 3000, date: '2026-11-04' },
  ]);
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  const chart = page.getByTestId('daily-expense-chart');
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + 44, y: box.y + 115 }],
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: box.x + 44 + (box.width - 54) / 3, y: box.y + 115 }],
  });
  await expect(page.getByTestId('daily-expense-selection')).toContainText(
    '11月2日',
  );
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: box.x + box.width - 10, y: box.y + 115 }],
  });
  await expect(page.getByTestId('daily-expense-selection')).toHaveText(
    '11月4日 · 支出 ¥30.00',
  );
  await expect(
    page.getByRole('tab', { name: '统计', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  const tip = (await page.getByTestId('daily-expense-tooltip').boundingBox())!;
  expect(tip.x).toBeGreaterThanOrEqual(box.x);
  expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width + 1);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await chart.focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('daily-expense-selection')).toContainText(
    '11月1日',
  );
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('daily-expense-selection')).toContainText(
    '11月2日',
  );
  await page.keyboard.press('End');
  await expect(page.getByTestId('daily-expense-selection')).toContainText(
    '11月4日',
  );
  await page.screenshot({ path: '/tmp/qingzhang-v050-chart-light.png' });
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await expect(page.getByTestId('daily-expense-tooltip')).not.toContainText(
    '30.00',
  );
  await expect(chart).not.toHaveAttribute('aria-label', /30\.00/);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 60, y: 150 }],
  });
  for (const x of [100, 150, 200, 250, 310])
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: 150 }],
    });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(
    page.getByRole('tab', { name: '账单', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await touch.detach();
});

test('a reversed sheet drag keeps the draft, while a deliberate drag dismisses it with normal motion', async ({
  page,
}) => {
  await page.emulateMedia({
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  await page.goto('/');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('8+2');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/qingzhang-v050-editor-dark.png' });
  const handle = (await page.getByTestId('sheet-drag-handle').boundingBox())!;
  const x = handle.x + handle.width / 2,
    y = handle.y + handle.height / 2;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (const dy of [15, 35, 55, 35, 15, 0]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + dy }],
    });
    await page.waitForTimeout(25);
    if (dy === 55)
      await expect
        .poll(
          async () =>
            (await page.getByTestId('sheet-drag-handle').boundingBox())!.y,
        )
        .toBeGreaterThan(handle.y + 5);
  }
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('8+2');
  await page.waitForTimeout(300);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (const dy of [20, 50, 90, 130, 160]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + dy }],
    });
    await page.waitForTimeout(25);
  }
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await touch.detach();
});

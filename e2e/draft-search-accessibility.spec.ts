import { test, expect, type Page } from '@playwright/test';
import { emptyLedger } from '../src/domain/ledger';
const key = 'qingzhang.entry-draft.v1';
const add = (page: Page) =>
  page.getByRole('button', { name: '记一笔', exact: true }).click();
const amount = (page: Page) =>
  page.getByRole('textbox', { name: '金额', exact: true });
async function waitDraft(page: Page, expression: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? 'null')?.fields.calculator
            .expression,
        key,
      ),
    )
    .toBe(expression);
}
test('unfinished calculation survives abrupt reload, resumes directly, saves once and clears on explicit cancel', async ({
  page,
}) => {
  await page.goto('/');
  await add(page);
  await amount(page).fill('28.5+1.5');
  await page
    .getByRole('textbox', { name: '备注', exact: true })
    .fill('自动草稿');
  await waitDraft(page, '28.5+1.5');
  expect(
    await page.evaluate(() => localStorage.getItem('qingzhang.ledger.v1')),
  ).toBeNull();
  await page.reload();
  await add(page);
  await expect(
    page.getByText('已恢复上次未完成的记账，确认后才会保存。'),
  ).toBeVisible();
  await expect(amount(page)).toHaveValue('28.5+1.5');
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('自动草稿');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await page.reload();
  await add(page);
  await expect(amount(page)).toHaveValue('');
  await amount(page).fill('99');
  await waitDraft(page, '99');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await page.reload();
  await add(page);
  await expect(amount(page)).toHaveValue('');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!).entries.length,
    ),
  ).toBe(1);
});
test('failed save retains a recoverable draft and editing drafts resume against their source', async ({
  page,
}) => {
  await page.goto('/');
  await add(page);
  await amount(page).fill('20');
  await page
    .getByRole('textbox', { name: '备注', exact: true })
    .fill('草稿失败重试');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'qingzhang.ledger.v1') throw new Error('账本写入失败');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText('账本写入失败');
  await page.reload();
  await add(page);
  await expect(amount(page)).toHaveValue('20');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  await page.getByRole('button', { name: /草稿失败重试.*查看详情/ }).click();
  await amount(page).fill('25+');
  await waitDraft(page, '25+');
  await page.reload();
  await add(page);
  await expect(amount(page)).toHaveValue('25+');
  await expect(page.getByText('编辑账单', { exact: true })).toBeVisible();
  await amount(page).fill('25');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!).entries.map(
        (e: any) => e.amount,
      ),
    ),
  ).toEqual([2500]);
});
test('amount search and inclusive range compose, and reselecting the active tab preserves filters', async ({
  page,
}) => {
  const ledger = emptyLedger();
  ledger.entries = Array.from({ length: 60 }, (_, i) => ({
    id: `search-${i}`,
    kind: 'expense',
    amount: i === 0 ? 2850 : 3000,
    categoryId: 'food',
    accountId: 'wechat',
    date: '2026-11-05',
    note: `搜索记录${i}`,
    createdAt: new Date(Date.UTC(2026, 10, 5, 12, 0, i)).toISOString(),
  }));
  await page.clock.install({ time: new Date('2026-11-05T04:00:00Z') });
  await page.addInitScript(
    (ledger) =>
      localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(ledger)),
    ledger,
  );
  await page.goto('/');
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索账单' }).fill('28.50');
  await expect(
    page.getByRole('button', { name: /搜索记录0.*查看详情/ }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: '搜索账单' }).fill('搜索记录');
  await page.getByRole('button', { name: '打开组合筛选', exact: true }).click();
  await page.getByRole('textbox', { name: '最低金额' }).fill('28.50');
  await page.getByRole('textbox', { name: '最高金额' }).fill('28.50');
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /搜索记录0.*查看详情/ }),
  ).toBeVisible();
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '搜索账单' })).toHaveValue(
    '搜索记录',
  );
  await expect(
    page.getByRole('button', { name: /搜索记录0.*查看详情/ }),
  ).toBeVisible();
});
test('reselecting each active dock tab returns its scroll view to the top without resetting search', async ({
  page,
}) => {
  const ledger = emptyLedger();
  ledger.entries = Array.from({ length: 80 }, (_, i) => ({
    id: `top-${i}`,
    kind: 'expense',
    amount: 100,
    categoryId: 'food',
    accountId: 'wechat',
    date: '2026-11-05',
    note: `回顶部${i}`,
    createdAt: new Date(Date.UTC(2026, 10, 5, 12, 0, i)).toISOString(),
  }));
  await page.clock.install({ time: new Date('2026-11-05T04:00:00Z') });
  await page.addInitScript(
    (ledger) =>
      localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(ledger)),
    ledger,
  );
  await page.goto('/');
  for (const [tab, key] of [
    ['首页', 'home'],
    ['账单', 'entries'],
    ['统计', 'stats'],
  ]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const scroll = page.getByTestId(`page-${key}-scroll`);
    if (key === 'entries')
      await page.getByRole('textbox', { name: '搜索账单' }).fill('回顶部');
    await scroll.evaluate((el) => {
      el.scrollTop = 350;
    });
    await expect
      .poll(() => scroll.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(100);
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0);
    if (key === 'entries')
      await expect(page.getByRole('textbox', { name: '搜索账单' })).toHaveValue(
        '回顶部',
      );
  }
});
test('reduced transparency uses opaque dock and sheets, with usable controls on narrow large-text layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(
        () => matchMedia('(prefers-reduced-transparency: reduce)').matches,
      ),
    )
    .toBe(true);
  const home = page.getByRole('tab', { name: '首页', exact: true });
  await expect
    .poll(() =>
      home.evaluate(
        (el) =>
          getComputedStyle(el.parentElement!.parentElement!).backgroundColor,
      ),
    )
    .toBe('rgb(255, 255, 255)');
  await page.addStyleTag({
    content:
      '[dir="auto"] { font-size: 150% !important; line-height: 1.5 !important; }',
  });
  await add(page);
  await expect(amount(page)).toBeVisible();
  const close = page.getByRole('button', { name: '关闭', exact: true });
  const rect = await close.boundingBox();
  expect(rect!.width).toBeGreaterThanOrEqual(44);
  expect(rect!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '/tmp/qingzhang-v060-accessibility.png' });
  await close.click();
  await expect(amount(page)).not.toBeVisible();
});

test('failed draft cleanup returns the closing sheet with a visible retry error', async ({
  page,
}) => {
  await page.goto('/');
  await add(page);
  await amount(page).fill('18');
  await waitDraft(page, '18');
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    (window as any).restoreDraftRemoval = () => {
      Storage.prototype.removeItem = original;
    };
    Storage.prototype.removeItem = function (key) {
      if (key === 'qingzhang.entry-draft.v1') throw new Error('清除失败');
      original.call(this, key);
    };
  });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText('草稿清除失败');
  await expect(amount(page)).toHaveValue('18');
  await page.evaluate(() => (window as any).restoreDraftRemoval());
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
});
test('stale edit draft shows an explanation and cannot overwrite a changed record', async ({
  page,
}) => {
  await page.goto('/');
  await add(page);
  await amount(page).fill('18');
  await page
    .getByRole('textbox', { name: '备注', exact: true })
    .fill('过期草稿');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  await page.getByRole('button', { name: /过期草稿.*查看详情/ }).click();
  await amount(page).fill('19');
  await waitDraft(page, '19');
  await page.evaluate(() => {
    const book = JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!);
    book.entries[0].amount = 2000;
    localStorage.setItem('qingzhang.ledger.v1', JSON.stringify(book));
  });
  await page.reload();
  await add(page);
  await expect(page.getByTestId('entry-error')).toContainText(
    '草稿对应的账单或设置已变化',
  );
  await expect(amount(page)).toHaveValue('');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('qingzhang.ledger.v1')!).entries[0]
          .amount,
    ),
  ).toBe(2000);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
});

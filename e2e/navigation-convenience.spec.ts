import { test, expect, type Page } from '@playwright/test';
import { emptyLedger, type Entry, type Ledger } from '../src/domain/ledger';
const draftKey = 'qingzhang.entry-draft.v1',
  ledgerKey = 'qingzhang.ledger.v1';
const amount = (page: Page) =>
  page.getByRole('textbox', { name: '金额', exact: true });
const add = (page: Page) =>
  page.getByRole('button', { name: '记一笔', exact: true }).click();
const original: Entry = {
  id: 'original',
  kind: 'expense',
  amount: 2850,
  categoryId: 'food',
  accountId: 'wechat',
  date: '2026-11-05',
  note: '原始记录',
  createdAt: '2026-11-05T01:00:00Z',
};
async function seed(page: Page, ledger = emptyLedger()) {
  await page.clock.setFixedTime(new Date('2026-11-05T04:00:00Z'));
  await page.addInitScript(
    ({ ledger, ledgerKey }) => {
      if (!localStorage.getItem(ledgerKey))
        localStorage.setItem(ledgerKey, JSON.stringify(ledger));
    },
    { ledger, ledgerKey },
  );
  await page.goto('/');
}
async function book(page: Page): Promise<Ledger> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ledgerKey,
  );
}
async function draftReady(page: Page, expression: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? 'null')?.fields.calculator
            .expression,
        draftKey,
      ),
    )
    .toBe(expression);
}
async function choose(page: Page, year: string, month: number) {
  await page.getByRole('textbox', { name: '选择年份', exact: true }).fill(year);
  await page
    .getByRole('button', { name: new RegExp(`^选择${year}年${month}月`) })
    .click();
  await expect(
    page.getByRole('textbox', { name: '选择年份', exact: true }),
  ).not.toBeVisible();
}
test('month jumping shares the selected month across pages, supports bounds and invalid years, and cancels without changes', async ({
  page,
}) => {
  await seed(page);
  await page
    .getByTestId('page-home')
    .getByRole('button', { name: '选择月份', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: '选择年份', exact: true })
    .fill('1899');
  await expect(page.getByText('请输入 1900–2200 之间的四位年份')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '选择1899年1月', exact: true }),
  ).toBeDisabled();
  await choose(page, '2024', 2);
  await expect(
    page
      .getByTestId('page-home')
      .getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2024 年 2 月');
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  const bills = page.getByTestId('page-entries');
  await expect(
    bills.getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2024 年 2 月');
  await bills.getByRole('button', { name: '选择月份', exact: true }).click();
  await page
    .getByRole('textbox', { name: '选择年份', exact: true })
    .fill('1900');
  await expect(
    page.getByRole('button', { name: '上一年', exact: true }),
  ).toBeDisabled();
  await choose(page, '1900', 1);
  await expect(
    bills.getByRole('button', { name: '上个月', exact: true }),
  ).toBeDisabled();
  await bills.getByRole('button', { name: '选择月份', exact: true }).click();
  await page
    .getByRole('textbox', { name: '选择年份', exact: true })
    .fill('2200');
  await expect(
    page.getByRole('button', { name: '下一年', exact: true }),
  ).toBeDisabled();
  await choose(page, '2200', 12);
  await expect(
    bills.getByRole('button', { name: '下个月', exact: true }),
  ).toBeDisabled();
  await page.getByRole('tab', { name: '统计', exact: true }).click();
  const stats = page.getByTestId('page-stats');
  await expect(
    stats.getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2200 年 12 月');
  await stats.getByRole('button', { name: '选择月份', exact: true }).click();
  await page.getByRole('button', { name: '返回本月', exact: true }).click();
  await expect(
    stats.getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2026 年 11 月');
  await stats.getByRole('button', { name: '选择月份', exact: true }).click();
  await page
    .getByRole('textbox', { name: '选择年份', exact: true })
    .fill('2000');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(
    stats.getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2026 年 11 月');
  expect((await book(page)).entries).toEqual([]);
});
test('budget month jumping stays separate from the browsing month and saves only the chosen month', async ({
  page,
}) => {
  await seed(page);
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await page.getByRole('button', { name: '预算选择月份', exact: true }).click();
  await choose(page, '2024', 2);
  await page
    .getByRole('textbox', { name: '月度预算金额', exact: true })
    .fill('300');
  expect((await book(page)).monthBudgets).toEqual({});
  await page.getByRole('button', { name: '保存预算', exact: true }).click();
  await expect
    .poll(async () => (await book(page)).monthBudgets['2024-02'])
    .toBe(30000);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(
    page
      .getByTestId('page-home')
      .getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2026 年 11 月');
});
test('restart clears a restored draft inside the same calculator and starts a fresh, recoverable record', async ({
  page,
}) => {
  await seed(page);
  await add(page);
  await amount(page).fill('18+2');
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('旧草稿');
  await draftReady(page, '18+2');
  await page.reload();
  await add(page);
  await amount(page).evaluate((el) => {
    (window as any).calculatorInput = el;
  });
  await page
    .getByRole('button', { name: '放弃草稿，重新记一笔', exact: true })
    .click();
  await expect(amount(page)).toHaveValue('');
  expect(
    await amount(page).evaluate((el) => el === (window as any).calculatorInput),
  ).toBe(true);
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('');
  await expect(
    page.getByRole('button', { name: '放弃草稿，重新记一笔', exact: true }),
  ).toHaveCount(0);
  expect((await book(page)).entries).toEqual([]);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBeNull();
  await amount(page).fill('8.5');
  await draftReady(page, '8.5');
  await page.reload();
  await add(page);
  await expect(amount(page)).toHaveValue('8.5');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(amount(page)).not.toBeVisible();
  expect((await book(page)).entries.map((e) => e.amount)).toEqual([850]);
});
for (const context of ['edit', 'refund', 'recurring'] as const) {
  test(`restart from a restored ${context} form never edits, refunds or advances its original source`, async ({
    page,
  }) => {
    const ledger = {
      ...emptyLedger(),
      entries: [original],
      recurringEnabled: true,
      recurringBills: [
        {
          id: 'rent',
          name: '房租',
          kind: 'expense' as const,
          amount: 200000,
          accountId: 'wechat',
          categoryId: 'home',
          note: '',
          enabled: true,
          cadence: 'monthly' as const,
          anchorDate: '2026-11-05',
          nextDate: '2026-11-05',
        },
      ],
    };
    await seed(page, ledger);
    if (context === 'recurring')
      await page.getByRole('button', { name: /确认周期账单房租/ }).click();
    else {
      await page.getByRole('button', { name: /原始记录.*查看详情/ }).click();
      if (context === 'refund')
        await page
          .getByRole('button', { name: '记录退款', exact: true })
          .click();
    }
    await amount(page).fill('10');
    await draftReady(page, '10');
    await page.reload();
    await add(page);
    await page
      .getByRole('button', { name: '放弃草稿，重新记一笔', exact: true })
      .click();
    await expect(amount(page)).toHaveValue('');
    await expect(
      page.getByRole('button', { name: '记好了', exact: true }),
    ).toBeVisible();
    await amount(page).fill('5');
    await page.getByRole('button', { name: '记好了', exact: true }).click();
    await expect(amount(page)).not.toBeVisible();
    const saved = await book(page);
    expect(saved.entries.find((e) => e.id === original.id)).toEqual(original);
    const added = saved.entries.find((e) => e.id !== original.id)!;
    expect(added.amount).toBe(500);
    expect(added.kind).toBe('expense');
    expect(added.originalEntryId).toBeUndefined();
    expect(added.recurringId).toBeUndefined();
    expect(saved.recurringBills[0]!.nextDate).toBe('2026-11-05');
  });
}
test('restart cleanup failure retains the old draft and supports an in-place retry', async ({
  page,
}) => {
  await seed(page);
  await add(page);
  await amount(page).fill('19');
  await draftReady(page, '19');
  await page.reload();
  await add(page);
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    (window as any).restoreRemoval = () =>
      (Storage.prototype.removeItem = original);
    Storage.prototype.removeItem = function (key) {
      if (key === 'qingzhang.entry-draft.v1') throw new Error('清理失败');
      original.call(this, key);
    };
  });
  await page
    .getByRole('button', { name: '放弃草稿，重新记一笔', exact: true })
    .click();
  await expect(page.getByTestId('entry-error')).toContainText('草稿清除失败');
  await expect(amount(page)).toHaveValue('19');
  await draftReady(page, '19');
  await page.evaluate(() => (window as any).restoreRemoval());
  await page
    .getByRole('button', { name: '放弃草稿，重新记一笔', exact: true })
    .click();
  await expect(amount(page)).toHaveValue('');
  expect((await book(page)).entries).toEqual([]);
});
test('amount filter summary shows inclusive ranges and hides them with the amount visibility setting', async ({
  page,
}) => {
  await seed(page);
  await page.getByRole('tab', { name: '账单', exact: true }).click();
  for (const [min, max, expected] of [
    ['20', '100', '¥20–100'],
    ['50', '', '≥¥50'],
    ['', '100', '≤¥100'],
    ['20.50', '20.5', '¥20.50'],
    ['0', '', '≥¥0'],
  ]) {
    await page
      .getByRole('button', { name: '打开组合筛选', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: '最低金额', exact: true })
      .fill(min!);
    await page
      .getByRole('textbox', { name: '最高金额', exact: true })
      .fill(max!);
    await page.getByRole('button', { name: '应用筛选', exact: true }).click();
    await expect(page.getByTestId('active-entry-filters')).toContainText(
      expected!,
    );
  }
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await expect(page.getByTestId('active-entry-filters')).toContainText(
    '金额条件',
  );
  await expect(page.getByTestId('active-entry-filters')).not.toContainText('¥');
  await page.getByRole('button', { name: '显示金额', exact: true }).click();
  await expect(page.getByTestId('active-entry-filters')).toContainText('≥¥0');
});
test('month grid fits a narrow dark screen and remains usable with enlarged labels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await seed(page);
  await page
    .getByTestId('page-home')
    .getByRole('button', { name: '选择月份', exact: true })
    .click();
  await page.addStyleTag({
    content:
      '[dir="auto"] { font-size: 150% !important; line-height: 1.5 !important; }',
  });
  await expect(
    page.getByRole('button', { name: '选择2026年12月', exact: true }),
  ).toBeInViewport();
  const rect = await page
    .getByRole('button', { name: '选择2026年1月', exact: true })
    .boundingBox();
  expect(rect!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '/tmp/qingzhang-v061-month-dark.png' });
  await choose(page, '2025', 12);
  await expect(
    page
      .getByTestId('page-home')
      .getByRole('button', { name: '选择月份', exact: true }),
  ).toHaveText('2025 年 12 月');
});

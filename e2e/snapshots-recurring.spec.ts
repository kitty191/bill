import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  emptyLedger,
  type Ledger,
  type RecurringBill,
} from '../src/domain/ledger';

const key = 'qingzhang.ledger.v1',
  historyKey = 'qingzhang.ledger.snapshots.v1';
const bill: RecurringBill = {
  id: 'rent',
  name: '房租',
  kind: 'expense',
  amount: 200000,
  accountId: 'wechat',
  categoryId: 'home',
  note: '',
  enabled: true,
  cadence: 'monthly',
  anchorDate: '2026-11-04',
  nextDate: '2026-11-04',
};
async function stored(page: Page): Promise<Ledger> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function seed(page: Page, ledger: object) {
  await page.addInitScript(
    ({ key, ledger }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(ledger));
    },
    { key, ledger },
  );
  await page.goto('/');
}
async function settings(page: Page, panel: string) {
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await page.getByRole('button', { name: panel, exact: true }).click();
}
async function record(page: Page, amount: string, note: string) {
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill(amount);
  await page.getByRole('textbox', { name: '备注', exact: true }).fill(note);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).not.toBeVisible();
}
async function failWrites(page: Page, target: string) {
  await page.evaluate((target) => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === target) throw new Error('存储空间不足');
      original.call(this, key, value);
    };
  }, target);
}

test('automatic snapshots can be previewed, exported, restored and reversed, with explicit history cleanup', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '1', '第一笔');
  await record(page, '2', '第二笔');
  await record(page, '3', '第三笔');
  await settings(page, '本机自动快照');
  await page
    .getByRole('button', { name: '查看本机快照1', exact: true })
    .click();
  await expect(page.getByTestId('snapshot-preview')).toContainText('2 笔账单');
  await expect(page.getByTestId('snapshot-preview')).toContainText(
    '净支出 ¥3.00',
  );
  expect((await stored(page)).entries).toHaveLength(3);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出此快照', exact: true }).click();
  const exported = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(exported.version).toBe(4);
  expect(exported.entries).toHaveLength(2);
  await page.getByRole('button', { name: '恢复此快照', exact: true }).click();
  expect((await stored(page)).entries).toHaveLength(3);
  await page.getByRole('button', { name: '确认恢复快照', exact: true }).click();
  await expect.poll(async () => (await stored(page)).entries.length).toBe(2);
  await page
    .getByRole('button', { name: '查看本机快照1', exact: true })
    .click();
  await expect(page.getByTestId('snapshot-preview')).toContainText('3 笔账单');
  await expect(page.getByTestId('snapshot-preview')).toContainText(
    '净支出 ¥6.00',
  );
  await page.screenshot({ path: '/tmp/qingzhang-v040-snapshots-light.png' });
  await page.getByRole('button', { name: '恢复此快照', exact: true }).click();
  await page.getByRole('button', { name: '确认恢复快照', exact: true }).click();
  await expect.poll(async () => (await stored(page)).entries.length).toBe(3);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  await settings(page, '本机自动快照');
  await page
    .getByRole('button', { name: '查看本机快照1', exact: true })
    .click();
  await expect(page.getByTestId('snapshot-preview')).toContainText(
    '净支出 ¥••••',
  );
  await page.getByRole('button', { name: '清理全部快照', exact: true }).click();
  await page.getByRole('button', { name: '确认清理快照', exact: true }).click();
  await expect(page.getByRole('button', { name: /^查看本机快照/ })).toHaveCount(
    0,
  );
  expect((await stored(page)).entries).toHaveLength(3);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '显示金额', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥6.00');
});

test('snapshot write failure blocks a financial change, retry works, and a corrupt snapshot cannot replace the ledger', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '10', '保留原账单');
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('20');
  await failWrites(page, historyKey);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText(
    '自动快照保存失败',
  );
  expect((await stored(page)).entries).toHaveLength(1);
  await page.evaluate(() => (window as any).restoreStorage());
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥30.00');
  await page.evaluate((historyKey) => {
    const items = JSON.parse(localStorage.getItem(historyKey)!);
    items[0].payload = '{broken';
    localStorage.setItem(historyKey, JSON.stringify(items));
  }, historyKey);
  await settings(page, '本机自动快照');
  await page
    .getByRole('button', { name: '查看本机快照1', exact: true })
    .click();
  await expect(page.getByTestId('snapshot-error')).toContainText('已损坏');
  await expect(
    page.getByRole('button', { name: '恢复此快照', exact: true }),
  ).toHaveCount(0);
  expect((await stored(page)).entries).toHaveLength(2);
});

test('a corrupt main record can be recovered from a validated local snapshot', async ({
  page,
}) => {
  await page.goto('/');
  await record(page, '10', '旧版本');
  await record(page, '20', '新版本');
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await page
    .getByRole('button', { name: '从本机快照恢复', exact: true })
    .click();
  await page
    .getByRole('button', { name: '查看本机快照1', exact: true })
    .click();
  await expect(page.getByTestId('snapshot-preview')).toContainText('1 笔账单');
  await page.getByRole('button', { name: '恢复此快照', exact: true }).click();
  await page.getByRole('button', { name: '确认恢复快照', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥10.00');
  expect((await stored(page)).entries).toHaveLength(1);
});

test('recurring reminders default off, survive reload, prefill without recording and advance only after confirmation', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await page.goto('/');
  await settings(page, '周期账单');
  await expect(
    page.getByRole('switch', { name: '启用周期账单提醒', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: '新增周期账单', exact: true }).click();
  await page
    .getByRole('textbox', { name: '周期账单名称', exact: true })
    .fill('房租');
  await page
    .getByRole('textbox', { name: '周期账单金额', exact: true })
    .fill('2000');
  await page.getByRole('button', { name: '周期分类居家', exact: true }).click();
  await page.getByRole('button', { name: '保存周期账单', exact: true }).click();
  expect((await stored(page)).entries).toHaveLength(0);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '确认周期账单房租', exact: true }),
  ).toHaveCount(0);
  await settings(page, '周期账单');
  await page
    .getByRole('switch', { name: '启用周期账单提醒', exact: true })
    .check();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '确认周期账单房租', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: '确认周期账单房租', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: '金额', exact: true }),
  ).toHaveValue('2000.00');
  await expect(
    page.getByRole('textbox', { name: '备注', exact: true }),
  ).toHaveValue('房租');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect((await stored(page)).entries).toHaveLength(0);
  expect((await stored(page)).recurringBills[0]!.nextDate).toBe('2026-11-04');
  await page
    .getByRole('button', { name: '确认周期账单房租', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: '金额', exact: true })
    .fill('1950.50');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  const saved = await stored(page);
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0]).toMatchObject({
    recurringId: saved.recurringBills[0]!.id,
    recurringDate: '2026-11-04',
    date: '2026-11-04',
    amount: 195050,
  });
  expect(saved.recurringBills[0]!.nextDate).toBe('2026-12-04');
  await expect(
    page.getByRole('button', { name: '确认周期账单房租', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: '修改刚保存的账单', exact: true })
    .click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('1960');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  expect((await stored(page)).entries[0]).toEqual({
    ...saved.entries[0],
    amount: 196000,
  });
  expect((await stored(page)).recurringBills).toEqual(saved.recurringBills);
  await settings(page, '周期账单');
  await page
    .getByRole('button', { name: '编辑周期账单房租', exact: true })
    .click();
  await page.getByRole('button', { name: '删除周期账单', exact: true }).click();
  await page
    .getByRole('button', { name: '确认删除周期账单', exact: true })
    .click();
  expect((await stored(page)).recurringBills).toEqual([]);
  expect((await stored(page)).entries).toHaveLength(1);
});

test('skipping overdue month-end cycles makes no transactions and keeps the original day', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-03-31T04:00:00Z'));
  await seed(page, {
    ...emptyLedger(),
    recurringEnabled: true,
    recurringBills: [
      { ...bill, anchorDate: '2026-01-31', nextDate: '2026-01-31' },
    ],
  });
  await page.getByRole('button', { name: '管理周期账单', exact: true }).click();
  for (const expected of ['2026-02-28', '2026-03-31']) {
    await page
      .getByRole('button', { name: '跳过周期账单房租', exact: true })
      .click();
    await page
      .getByRole('button', { name: '确认跳过本期', exact: true })
      .click();
    await expect
      .poll(async () => (await stored(page)).recurringBills[0]!.nextDate)
      .toBe(expected);
    expect((await stored(page)).entries).toHaveLength(0);
  }
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '确认周期账单房租', exact: true })
    .click();
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  const saved = await stored(page);
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0]!.recurringDate).toBe('2026-03-31');
  expect(saved.recurringBills[0]!.nextDate).toBe('2026-04-30');
});

test('recurring confirmation write failure leaves both occurrence and finances unchanged', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await seed(page, {
    ...emptyLedger(),
    recurringEnabled: true,
    recurringBills: [bill],
  });
  await page
    .getByRole('button', { name: '确认周期账单房租', exact: true })
    .click();
  await failWrites(page, key);
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('entry-error')).toContainText('存储空间不足');
  expect((await stored(page)).entries).toHaveLength(0);
  expect((await stored(page)).recurringBills[0]!.nextDate).toBe('2026-11-04');
  await page.evaluate(() => (window as any).restoreStorage());
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('today-expense')).toHaveText('¥2,000.00');
  expect((await stored(page)).entries).toHaveLength(1);
  expect((await stored(page)).recurringBills[0]!.nextDate).toBe('2026-12-04');
});

test('v3 migration keeps its exact source and fits narrow dark recurring settings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const { recurringEnabled, recurringBills, ...base } = emptyLedger();
  const legacy = {
    ...base,
    version: 3,
    monthlyBudget: 12345,
    monthBudgets: { '2026-11': 30000 },
  };
  await seed(page, legacy);
  await record(page, '12', '升级后');
  expect((await stored(page)).version).toBe(4);
  expect((await stored(page)).monthBudgets).toEqual(legacy.monthBudgets);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('qingzhang.ledger.before-v4')!),
    ),
  ).toEqual(legacy);
  await settings(page, '周期账单');
  await page.getByRole('button', { name: '新增周期账单', exact: true }).click();
  await page
    .getByRole('textbox', { name: '周期账单名称', exact: true })
    .fill('会员');
  await page
    .getByRole('textbox', { name: '周期账单金额', exact: true })
    .fill('25');
  await page.screenshot({ path: '/tmp/qingzhang-v040-recurring-dark.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  expect((await stored(page)).recurringBills).toHaveLength(0);
});

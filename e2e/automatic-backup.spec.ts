import { test, expect, type Page } from '@playwright/test';
import { emptyLedger, type Ledger } from '../src/domain/ledger';
const preferencesKey = 'qingzhang.automatic-backup.v1',
  ledgerKey = 'qingzhang.ledger.v1';
async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-05T04:00:00Z'));
  await page.addInitScript(() => {
    (window as any).backupPickerCalls = 0;
    (window as any).showDirectoryPicker = async () => {
      (window as any).backupPickerCalls++;
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle('qingzhang-backup-fixture', {
        create: true,
      });
    };
  });
  const ledger: Ledger = {
    ...emptyLedger(),
    entries: [
      {
        id: 'backup-record',
        kind: 'expense',
        amount: 1234,
        categoryId: 'food',
        accountId: 'wechat',
        date: '2026-11-05',
        note: '独立备份测试',
        createdAt: '2026-11-05T01:00:00Z',
      },
    ],
  };
  await page.addInitScript(
    ({ ledger, ledgerKey }) => {
      if (!localStorage.getItem(ledgerKey))
        localStorage.setItem(ledgerKey, JSON.stringify(ledger));
    },
    { ledger, ledgerKey },
  );
  await page.goto('/');
  await expect(page.getByTestId('month-expense')).toHaveText('12.34');
  return ledger;
}
async function privacy(page: Page) {
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await page
    .getByRole('button', { name: '隐私与备份提醒', exact: true })
    .click();
  await expect(page.getByText('自动文件备份', { exact: true })).toBeVisible();
}
async function files(page: Page): Promise<Record<string, string>> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(
      'qingzhang-backup-fixture',
      { create: true },
    );
    const entries: Record<string, string> = {};
    for await (const handle of (directory as any).values())
      if (handle.kind === 'file')
        entries[handle.name] = await (await handle.getFile()).text();
    return entries;
  });
}
async function pref(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    preferencesKey,
  );
}
test('automatic files are opt-in, verified JSON survives reload, due checks retry on foreground and preserve financial data', async ({
  page,
}) => {
  const original = await setup(page);
  expect(await page.evaluate(() => (window as any).backupPickerCalls)).toBe(0);
  expect(await files(page)).toEqual({});
  await privacy(page);
  await page.getByRole('button', { name: '每天备份', exact: true }).click();
  await expect.poll(async () => Object.keys(await files(page)).length).toBe(1);
  await expect
    .poll(async () => (await pref(page)).lastSuccessAt)
    .toBe('2026-11-05T04:00:00.000Z');
  const content = Object.values(await files(page))[0]!;
  expect(JSON.parse(content)).toEqual(original);
  expect(JSON.parse(content).automaticBackup).toBeUndefined();
  expect(JSON.parse(content).entryDraft).toBeUndefined();
  await page.reload();
  expect(await page.evaluate(() => (window as any).backupPickerCalls)).toBe(0);
  expect(Object.keys(await files(page))).toHaveLength(1);
  await page.clock.setFixedTime(new Date('2026-11-06T05:00:00Z'));
  await page.reload();
  await expect.poll(async () => Object.keys(await files(page)).length).toBe(2);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      ledgerKey,
    ),
  ).toEqual(original);
  await privacy(page);
  await page.getByRole('button', { name: '关闭自动备份', exact: true }).click();
  await expect.poll(async () => (await pref(page)).days).toBe(0);
  await page.clock.setFixedTime(new Date('2026-11-10T05:00:00Z'));
  await page.reload();
  await page.waitForTimeout(1800);
  expect(Object.keys(await files(page))).toHaveLength(2);
});
test('manual independent backups keep seven valid owned versions and preserve unrelated files', async ({
  page,
}) => {
  await setup(page);
  await privacy(page);
  await page
    .getByRole('button', { name: '选择自动备份目录', exact: true })
    .click();
  await expect.poll(async () => (await pref(page))?.directory ?? null).not.toBeNull();
  await page.evaluate(async () => {
    const dir = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle('qingzhang-backup-fixture');
    const writer = await (
      await dir.getFileHandle('my-other-document.json', { create: true })
    ).createWritable();
    await writer.write('unrelated');
    await writer.close();
  });
  for (let i = 0; i < 9; i++) {
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 10, 5 + i, 5)));
    await page
      .getByRole('button', { name: '立即生成自动备份', exact: true })
      .click();
    await expect
      .poll(async () => (await pref(page)).lastSuccessAt)
      .toBe(new Date(Date.UTC(2026, 10, 5 + i, 5)).toISOString());
  }
  const archived = await files(page);
  expect(archived['my-other-document.json']).toBe('unrelated');
  expect(
    Object.keys(archived).filter((name) => name.startsWith('qingzhang-auto-')),
  ).toHaveLength(7);
  await page.screenshot({
    path: '/tmp/qingzhang-v070-automatic-backup-light.png',
  });
});
test('a cancelled directory picker keeps automation off without changing records', async ({
  page,
}) => {
  const original = await setup(page);
  await privacy(page);
  await page.evaluate(() => {
    (window as any).showDirectoryPicker = async () => {
      throw new DOMException('cancelled', 'AbortError');
    };
  });
  await page.getByRole('button', { name: '每周备份', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '每周备份', exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferencesKey),
  ).toBeNull();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      ledgerKey,
    ),
  ).toEqual(original);
});
test('write failures retain earlier backups and expose errors without failing financial saves', async ({
  page,
}) => {
  await setup(page);
  await privacy(page);
  await page
    .getByRole('button', { name: '选择自动备份目录', exact: true })
    .click();
  await page
    .getByRole('button', { name: '立即生成自动备份', exact: true })
    .click();
  await expect
    .poll(async () => (await pref(page)).lastSuccessAt)
    .not.toBeNull();
  const previous = await pref(page),
    before = await files(page);
  await page.evaluate(() => {
    const original = FileSystemFileHandle.prototype.createWritable;
    (window as any).restoreBackupWriter = () =>
      (FileSystemFileHandle.prototype.createWritable = original);
    FileSystemFileHandle.prototype.createWritable = async () => {
      throw new DOMException('disk full', 'QuotaExceededError');
    };
  });
  await page
    .getByRole('button', { name: '立即生成自动备份', exact: true })
    .click();
  await expect(page.getByTestId('automatic-backup-error')).toContainText(
    'disk full',
  );
  expect((await pref(page)).lastSuccessAt).toBe(previous.lastSuccessAt);
  // Creating a handle before a provider fails may leave a zero-byte file, but
  // no old archive may be pruned or marked as the latest successful backup.
  const after = await files(page);
  for (const [name, content] of Object.entries(before))
    expect(after[name]).toBe(content);
  await page.evaluate(() => (window as any).restoreBackupWriter());
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '记一笔', exact: true }).click();
  await page.getByRole('textbox', { name: '金额', exact: true }).fill('5');
  await page.getByRole('button', { name: '记好了', exact: true }).click();
  await expect(page.getByTestId('month-expense')).toHaveText('17.34');
});
test('corrupt automation settings can be reset without overwriting a valid ledger', async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, '{broken'),
    preferencesKey,
  );
  const original = await setup(page);
  await privacy(page);
  await expect(page.getByTestId('automatic-backup-error')).toContainText(
    '无法读取',
  );
  await page
    .getByRole('button', { name: '重置自动备份设置', exact: true })
    .click();
  await expect.poll(async () => (await pref(page))?.days).toBe(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      ledgerKey,
    ),
  ).toEqual(original);
});

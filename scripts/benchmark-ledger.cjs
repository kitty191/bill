const { chromium, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const root = path.resolve(process.argv[2]);
  const output = process.argv[3];
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return response.writeHead(404).end();
    response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const month = '2026-11';
      localStorage.setItem('qingzhang.ledger.v1', JSON.stringify({
        version: 4, monthlyBudget: 0, monthBudgets: {}, showAccountCards: false,
        recurringEnabled: false, recurringBills: [], templates: [], defaults: {},
        accounts: [{ id: 'wechat', name: '微信', openingBalance: 0 }],
        categories: [{ id: 'food', label: '餐饮', kind: 'expense', hidden: false, color: '#E99764', icon: 'utensils' }, { id: 'salary', label: '工资', kind: 'income', hidden: false, color: '#548D75', icon: 'briefcase' }],
        entries: Array.from({ length: 10000 }, (_, index) => ({
          id: `large-${index}`, kind: 'expense', amount: 100, categoryId: 'food', accountId: 'wechat',
          date: `${month}-${String((index % 28) + 1).padStart(2, '0')}`, note: `性能-${index}`, createdAt: new Date(Date.UTC(2026, 10, 28, 12) - index * 1000).toISOString(),
        })),
      }));
    });
    await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    const start = performance.now();
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 120000 });
    await expect(page.getByTestId('month-expense')).toHaveText('10,000.00', { timeout: 120000 });
    const startupMs = performance.now() - start;
    const navigationStart = performance.now();
    await page.getByRole('tab', { name: '账单', exact: true }).click();
    const entries = page.getByTestId('page-entries');
    await expect(entries.getByRole('button', { name: /性能-27 .*查看详情/ })).toBeVisible();
    const navigationMs = performance.now() - navigationStart;
    const rowCount = await entries.getByRole('button', { name: /查看详情$/ }).count();
    const query = page.getByRole('textbox', { name: '搜索账单', exact: true });
    const searchStart = performance.now();
    await query.fill('性能-9999');
    await expect(entries.getByRole('button', { name: /性能-9999 .*查看详情/ })).toBeVisible();
    await expect(entries.getByRole('button', { name: /查看详情$/ })).toHaveCount(1);
    const searchMs = performance.now() - searchStart;
    const clearStart = performance.now();
    await query.fill('');
    await expect(entries.getByRole('button', { name: /性能-27 .*查看详情/ })).toBeVisible();
    const clearMs = performance.now() - clearStart;
    await page.getByRole('button', { name: '筛选收入', exact: true }).click();
    await expect(entries.getByText('没有找到这些账单', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '记一笔', exact: true }).click();
    await page.getByRole('textbox', { name: '金额', exact: true }).fill('2.50');
    const saveStart = performance.now();
    await page.getByRole('button', { name: '记好了', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '金额', exact: true })).not.toBeVisible();
    const saveMs = performance.now() - saveStart;
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('qingzhang.ledger.v1')));
    if (stored.entries.length !== 10001) throw new Error('Large-ledger save lost records');
    const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
    const report = { records: 10000, mountedEntryRows: rowCount, startupMs, navigationMs, searchMs, clearMs, saveMs, jsHeapBytes: metrics.JSHeapUsedSize, domNodes: metrics.Nodes, runtimeErrors: errors, platform: 'Chromium web, one sample; not native FPS or mobile storage timing' };
    if (errors.length) throw new Error(JSON.stringify(errors));
    if (process.argv.includes('--check') && rowCount >= 250) throw new Error('Too many mounted rows: ' + rowCount);
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

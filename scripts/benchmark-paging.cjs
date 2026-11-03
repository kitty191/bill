const { chromium, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const root = path.resolve(process.argv[2]);
  const server = http.createServer((request, response) => {
    const file = path.join(
      root,
      new URL(request.url, 'http://localhost').pathname === '/'
        ? 'index.html'
        : decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
    );
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader(
      'Content-Type',
      file.endsWith('.js')
        ? 'application/javascript'
        : file.endsWith('.html')
          ? 'text/html'
          : 'application/octet-stream',
    );
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__qingzhangRenders = {};
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      localStorage.setItem(
        'qingzhang.ledger.v1',
        JSON.stringify({
          version: 1,
          monthlyBudget: 500000,
          showAccountCards: false,
          accounts: [
            { id: 'wechat', name: '微信', openingBalance: 0 },
            { id: 'alipay', name: '支付宝', openingBalance: 0 },
            { id: 'bank', name: '银行卡', openingBalance: 0 },
            { id: 'cash', name: '现金', openingBalance: 0 },
          ],
          entries: Array.from({ length: 1000 }, (_, index) => ({
            id: `perf-${index}`,
            kind: 'expense',
            amount: 100,
            categoryId: 'food',
            accountId: 'wechat',
            date: `${month}-${String((index % 28) + 1).padStart(2, '0')}`,
            note: '性能验证记录',
            createdAt: new Date(now.getTime() - index * 1000).toISOString(),
          })),
        }),
      );
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByTestId('month-expense')).toHaveText('1,000.00');
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    const before = (await session.send('Performance.getMetrics')).metrics;
    await page.evaluate(() => {
      window.__qingzhangRenders = {};
    });
    for (let round = 0; round < 3; round++) {
      for (const [label, key] of [
        ['账单', 'entries'],
        ['统计', 'stats'],
        ['首页', 'home'],
      ]) {
        await page.getByRole('tab', { name: label, exact: true }).click();
        await expect(
          page.getByRole('tab', { name: label, exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect
          .poll(async () =>
            Math.abs(
              (await page.getByTestId(`page-${key}`).boundingBox()).x - 1,
            ),
          )
          .toBeLessThan(3);
      }
    }
    const after = (await session.send('Performance.getMetrics')).metrics;
    const delta = {};
    for (const name of [
      'TaskDuration',
      'ScriptDuration',
      'LayoutDuration',
      'RecalcStyleDuration',
      'LayoutCount',
    ])
      delta[name] =
        after.find((metric) => metric.name === name).value -
        before.find((metric) => metric.name === name).value;
    const report = {
      records: 1000,
      pageChanges: 9,
      screenRenders: await page.evaluate(() =>
        Object.fromEntries(
          ['HomeScreen', 'EntriesScreen', 'StatsScreen'].map((name) => [
            name,
            window.__qingzhangRenders[name] || 0,
          ]),
        ),
      ),
      metrics: delta,
      runtimeErrors: errors,
      platform: 'Chromium web; not native FPS',
    };
    if (errors.length) throw new Error(JSON.stringify(errors));
    if (
      process.argv.includes('--check') &&
      Object.values(report.screenRenders).some((count) => count !== 0)
    )
      throw new Error(
        'Static screens re-rendered during paging: ' +
          JSON.stringify(report.screenRenders),
      );
    fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

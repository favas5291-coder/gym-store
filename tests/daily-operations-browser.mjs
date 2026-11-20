import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockStorefront, startStorefrontFixture } from './storefront-fixture.mjs';

const port = 4248;
process.env.VITE_API_URL = 'http://127.0.0.1:' + port + '/api';
process.env.VITE_DAILY_OPERATIONS_ENABLED = 'true';
const fixture = await startStorefrontFixture(port);
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.GYMDROBE_CHROMIUM_PATH ? { executablePath: process.env.GYMDROBE_CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const mock = await mockStorefront(context, fixture.products, { signedIn: true });
  let role = 'admin';
  await context.route('**/api/auth/me', route =>
    route.fulfill({ json: { success: true, user: { ...mock.user, role } } }));
  await context.route('**/api/admin/dashboard?**', route => route.fulfill({ json: {
    success: true, stats: {}, sales: { summary: {}, points: [] }, recentOrders: [],
  } }));
  const calls = [];
  await context.route('**/api/admin/reports/daily-operations?**', route => {
    assert.equal(route.request().method(), 'GET');
    assert.match(route.request().headers().authorization, /^Bearer /);
    const { searchParams } = new URL(route.request().url());
    const date = searchParams.get('date'), source = searchParams.get('source');
    calls.push({ date, source });
    if (calls.length === 1) {
      return route.fulfill({ status: 503, json: { success: false, message: 'Daily report temporarily unavailable.' } });
    }
    const unknown = { knownOrders: 0, unknownOrders: 2, knownPaise: 0 };
    const zero = { knownOrders: 0, unknownOrders: 0, knownPaise: 0 };
    return route.fulfill({ json: { success: true, report: {
      date, source, timezone: 'Asia/Kolkata', generatedAt: '2024-02-29T04:30:00Z',
      orders: { all: 2, confirmed: 2, cancelled: 0, paymentPending: 0, other: 0 },
      confirmedOrderValue: { knownOrders: 1, unknownOrders: 1, knownPaise: 12345 },
      grossCollections: unknown, refunds: unknown, codOutstanding: zero, codRecordedCollections: zero,
      fulfilments: { pending: 1, accepted: 0, preparing: 0, shipped: 1, delivered: 0, cancelled: 0, unknown: 0 },
      netProfitPaise: null,
    } } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(fixture.url + '/admin');
  const panel = page.getByRole('region', { name: 'Daily operations' });
  await panel.waitFor();
  assert.equal(calls.length, 0);
  await panel.getByLabel('Order creation date in India').fill('2024-02-29');
  await panel.getByRole('button', { name: 'Load daily report' }).click();
  await panel.getByText('Daily report temporarily unavailable.').waitFor();
  await panel.getByRole('button', { name: 'Try again' }).click();
  await panel.getByRole('heading', { name: 'Supplier fulfilment' }).waitFor();
  assert.equal(calls.at(-1).date, '2024-02-29');
  assert.equal(calls.at(-1).source, 'real');
  const amount = label => panel.locator('dt', { hasText: label }).locator('..').locator('dd').innerText();
  assert.match(await amount('Confirmed order value'), /₹123\.45\s*Missing data for 1 order/);
  assert.match(await amount('Recorded customer collections'), /Unavailable\s*Missing data for 2 orders/);
  assert.equal(await amount('COD still due'), '₹0.00');
  assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await panel.getByLabel('Order creation date in India').fill('2024-03-01');
  await panel.getByRole('heading', { name: 'Supplier fulfilment' }).waitFor({ state: 'detached' });
  await page.getByLabel('Order type').selectOption('test');
  assert.equal(calls.length, 2);
  await panel.getByRole('button', { name: 'Load daily report' }).click();
  await panel.getByRole('heading', { name: 'Supplier fulfilment' }).waitFor();
  assert.equal(calls.at(-1).source, 'test');
  const count = calls.length;
  role = 'customer';
  await page.reload();
  await page.waitForURL(fixture.url + '/');
  assert.equal(await panel.count(), 0);
  assert.equal(calls.length, count);
  assert.deepEqual(errors, []);
  console.log('Daily report browser checks passed for access, on-demand loading, retry, amount coverage, mobile width and real/test isolation.');
} finally {
  await browser?.close();
  await fixture.server.close();
}

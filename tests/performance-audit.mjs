// Identical production-preview lab samples, never live payments/customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { preview } from 'vite';
import { startStorefrontFixture, mockStorefront, fixtureProductId } from './storefront-fixture.mjs';
const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.PERFORMANCE_OUTPUT || 'test-results/performance';
await fs.mkdir(output, { recursive: true });
const fixture = await startStorefrontFixture(4220);
const server = await preview({ preview: { host: '127.0.0.1', port: 4221, strictPort: true } });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.GYMDROBE_CHROMIUM_PATH ? { executablePath: process.env.GYMDROBE_CHROMIUM_PATH } : {}) });
const files = await fs.readdir('dist/assets');
function built(value) {
  if (Array.isArray(value)) return value.map(built);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, built(v)]));
  if (typeof value === 'string' && value.startsWith('/src/assets/')) {
    const original = decodeURIComponent(value.split('/').at(-1).split('?')[0]);
    const ext = path.extname(original), base = path.basename(original, ext);
    const match = files.find(file => file.startsWith(base + '-') && file.endsWith(ext));
    return match ? '/assets/' + match : value;
  }
  return value;
}
const products = built(fixture.products.map(product => ({ ...product, colorImages: [] })));
const samples = [];
// Cover the routes shoppers actually open, not just the home and shop entry
// points. All scenarios use the same isolated mock APIs and no customer data.
const routes = [
  { path: '/', label: 'home', ready: '.department-campaign, .editorial-hero, .cinema-hero, .home-carousel-card, .home-carousel-photo' },
  { path: '/shop', label: 'shop', ready: '.gm-product-card' },
  { path: '/shop?search=training', label: 'search', ready: '.gm-product-card' },
  { path: `/product/${products[0].id}`, label: 'product', ready: '.product-detail-layout' },
  { path: '/cart', label: 'cart-empty', ready: '.cart-page' },
  { path: '/login', label: 'login-guest', ready: '.auth-page' },
];
try {
  for (const width of [390, 1440]) for (const scenario of routes) for (let run = 1; run <= 3; run++) {
    const route = scenario.path;
    const context = await browser.newContext({ viewport: { width, height: 960 }, isMobile: width === 390, hasTouch: width === 390 });
    const mock = await mockStorefront(context, products);
    await context.addInitScript(() => {
      window.lab = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0, shifts: [], lcpCandidates: [] };
      const products = new MutationObserver(() => {
        if (document.querySelector('.gm-product-card h3, .product-detail-layout h1')) {
          requestAnimationFrame(() => { window.lab.productContentMs = performance.now(); });
          products.disconnect();
        }
      });
      products.observe(document, { childList: true, subtree: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) { window.lab.lcp = entry.startTime; window.lab.lcpCandidates.push({ time: entry.startTime, tag: entry.element?.tagName, parent: entry.element?.parentElement?.className, url: entry.url, size: entry.size }); } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
        window.lab.cls += entry.value;
        window.lab.shifts.push({ value: entry.value, sources: entry.sources.map(s => ({ node: s.node?.className || s.node?.tagName, from: s.previousRect.toJSON(), to: s.currentRect.toJSON() })) });
      } }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) { window.lab.longTasks++; window.lab.longTaskMs += entry.duration; } }).observe({ type: 'longtask', buffered: true });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    if (width === 390) {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.goto('http://127.0.0.1:4221' + route, { waitUntil: 'domcontentloaded' });
    await page.locator(scenario.ready).first().waitFor();
    await page.waitForTimeout(width === 390 ? 9000 : 3000);
    const metrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource').map(r => ({ url: new URL(r.name).pathname, kind: r.initiatorType, bytes: r.encodedBodySize, duration: r.duration }));
      const sum = rows => rows.reduce((total, row) => total + row.bytes, 0);
      const images = resources.filter(r => /\.(jpg|jpeg|png|webp|avif)$/i.test(r.url));
      return { ...window.lab, dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
        bytes: sum(resources), imageBytes: sum(images), imageRequests: images.length,
        jsBytes: sum(resources.filter(r => r.url.endsWith('.js'))), cssBytes: sum(resources.filter(r => r.url.endsWith('.css'))),
        alternateImages: document.querySelectorAll('.alternate-photo').length, resources };
    });
    samples.push({ width, route, run, ...metrics, apiRequests: mock.requests.length });
    console.log('PERFORMANCE_SAMPLE', JSON.stringify({ width, route, run, lcp: metrics.lcp, cls: metrics.cls, bytes: metrics.bytes, imageBytes: metrics.imageBytes, jsBytes: metrics.jsBytes }));
    if (process.env.PERFORMANCE_ASSERT === '1') {
      assert.equal(mock.requests.filter(({ path, method }) => path === '/api/products' && method === 'GET').length, 1, 'Catalogue startup and React must share a single request');
    }
    if (process.env.PERFORMANCE_ASSERT === '1' && route === '/shop') {
      assert.ok(metrics.cls <= 0.1, `Shop layout shift exceeded target: ${JSON.stringify(metrics)}`);
      assert.equal(metrics.alternateImages, 0, 'Hidden alternate photos must not load without intent');
      if (width === 1440) {
        await page.locator('.gm-product-card').first().hover();
        await page.locator('.gm-product-card').first().locator('.alternate-photo').waitFor();
      }
    }
    if (run === 1) await page.screenshot({ path: path.join(output, `${width}-${scenario.label}.png`) });
    await context.close();
  }
  const html = await fs.readFile('dist/index.html', 'utf8');
  const entryPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]);
  const entry = await Promise.all(entryPaths.map(async file => {
    const bytes = await fs.readFile(path.join('dist', file));
    return { path: file, bytes: bytes.length, gzip: gzipSync(bytes).length };
  }));
  await fs.writeFile(path.join(output, 'audit.json'), JSON.stringify({ conditions: {
    browser: await browser.version(), cache: 'Fresh context per sample; three samples per route/viewport',
    desktop: '1440×960, no network/CPU throttle', mobile: '390×960, touch, 4× CPU, 150ms RTT, 1.6Mbps down',
    assets: 'Identical local photographs with alternate photos; instant mocked APIs; public product, search, empty cart and guest login only',
    limitations: 'Lab only, no CDN compression. Cart is empty and login is signed-out; no checkout/payment/account journeys. No field INP, real API latency, physical-device or iOS-app claim.'
  }, entry, samples }, null, 2));
  // Capture the approval views with identical data and viewport on both revisions.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await mockStorefront(phone, products);
  const page = await phone.newPage();
  page.setDefaultTimeout(12000);
  const visit = route => page.goto('http://127.0.0.1:4221' + route);
  const snap = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, 'mobile-' + name + '.png'), animations: 'disabled' });
  };
  await visit('/product/' + fixtureProductId);
  await page.getByRole('button', { name: 'Colour Black', exact: true }).first().click();
  await page.getByRole('button', { name: 'Size M', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save to wishlist', exact: true }).click();
  await page.getByRole('button', { name: /Add to (Cart|Bag)/i }).first().click();
  await page.getByText('✓ Added to your bag').waitFor();
  await visit('/cart');
  await page.getByRole('combobox', { name: 'Quantity for Gym Training T-Shirt' }).waitFor();
  await snap('bag');
  await page.locator('.shopping-bottom-nav').screenshot({ path: path.join(output, 'mobile-navigation.png') });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await snap('menu');
  await visit('/wishlist');
  await page.getByRole('heading', { name: 'Gym Training T-Shirt' }).waitFor();
  await snap('wishlist');
  await visit('/categories');
  await page.locator('.native-collection').first().waitFor();
  await snap('categories');
  await page.getByRole('button', { name: 'Open search', exact: true }).click();
  await page.locator('.gn-results').waitFor();
  await snap('search');
  await visit('/shop');
  await page.getByRole('button', { name: 'Help me choose products', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Find your workout gear' });
  await guide.waitFor();
  await snap('guide-needs');
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await guide.getByRole('button', { name: '₹1,000', exact: true }).click();
  await snap('guide-budget');
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await snap('guide-goal');
  await phone.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  await fixture.server.close();
}

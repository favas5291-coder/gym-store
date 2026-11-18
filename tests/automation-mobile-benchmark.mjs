// Identical production-preview lab samples, never live payments/customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { preview } from 'vite';
import { startStorefrontFixture, mockStorefront } from './storefront-fixture.mjs';
const { chromium } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.PERFORMANCE_OUTPUT || 'test-results/automation-mobile';
await fs.mkdir(output, { recursive: true });
const fixture = await startStorefrontFixture(4384);
const server = await preview({ preview: { host: '127.0.0.1', port: 4385, strictPort: true } });
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
const routes = [
  { path: '/', label: 'home', ready: '.department-campaign, .editorial-hero, .cinema-hero, .home-carousel-card, .home-carousel-photo' },
  { path: '/shop', label: 'shop', ready: '.gm-product-card' },
  { path: '/cart', label: 'cart', ready: '.cart-row' },
];
try {
  const width = 390;
  for (const scenario of routes) for (let run = 1; run <= 3; run++) {
    const route = scenario.path;
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    const mock = await mockStorefront(context, products);
    await context.addInitScript(({cart, product, ready}) => {
      if (cart) localStorage.setItem('gymdrobe-cart', JSON.stringify([{...product,selectedSize:'M',selectedColor:'Black',quantity:1}]));
      const readyObserver = new MutationObserver(() => {
        if (document.querySelector(ready)) {
          readyObserver.disconnect();
          requestAnimationFrame(() => { window.contentRender = performance.now() });
        }
      });
      readyObserver.observe(document, {childList:true, subtree:true});
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
    }, {cart:route==='/cart',product:products[0],ready:scenario.ready});
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('http://127.0.0.1:4385' + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator(scenario.ready).first().waitFor();
    await page.waitForTimeout(5500);
    const metrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource').map(r => ({ url: new URL(r.name).pathname, kind: r.initiatorType, bytes: r.encodedBodySize, duration: r.duration }));
      const sum = rows => rows.reduce((total, row) => total + row.bytes, 0);
      const images = resources.filter(r => /\.(jpg|jpeg|png|webp|avif)$/i.test(r.url));
      return { ...window.lab, contentReadyMs:window.contentRender, cartRows:document.querySelectorAll('.cart-row').length, dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
        bytes: sum(resources), imageBytes: sum(images), imageRequests: images.length,
        jsBytes: sum(resources.filter(r => r.url.endsWith('.js'))), cssBytes: sum(resources.filter(r => r.url.endsWith('.css'))),
        alternateImages: document.querySelectorAll('.alternate-photo').length, resources };
    });
    assert.ok(metrics.contentReadyMs > 0 && metrics.lcp > 0, 'missing primary metrics');
    if(route === '/cart') assert.equal(metrics.cartRows, 1);
    const active = [...new Set(metrics.resources.map(r=>r.url).filter(url=>url.startsWith('/assets/') && /\.(js|css)$/.test(url)))];
    metrics.routeGzipBytes = (await Promise.all(active.map(async url => gzipSync(await fs.readFile(path.join('dist',url))).length))).reduce((a,b)=>a+b,0);
    samples.push({ width, route, run, ...metrics, apiRequests: mock.requests.length });
    console.log('PERFORMANCE_SAMPLE', JSON.stringify({ width, route, run, lcp: metrics.lcp, cls: metrics.cls, bytes: metrics.bytes, imageBytes: metrics.imageBytes, jsBytes: metrics.jsBytes }));
    if (process.env.PERFORMANCE_ASSERT === '1') {
      assert.equal(mock.requests.filter(({ path, method }) => path === '/api/products' && method === 'GET').length, 1, 'Catalogue startup and React must share a single request');
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
    mobile: '390×844, touch, 4× CPU, 150ms RTT, 1.6Mbps down',
    assets: 'Built storefront with local fixture photographs and synthetic API responses. Homepage, Shop and a verified one-line cart.',
    limitations: 'Lab only, no CDN compression. Cart is seeded locally; no checkout/payment/account journeys. Measures neither field INP nor production API/CDN or physical-device performance.'
  }, entry, samples }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  await fixture.server.close();
}

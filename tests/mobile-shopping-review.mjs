// Runs against both checkouts with one cached public catalogue and isolated shopping APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root = path.resolve(process.argv[2] || '.');
const output = path.resolve(process.argv[3] || 'test-results/mobile-shopping/after');
const cataloguePath = path.resolve('test-results/mobile-shopping/catalogue.json');
await fs.mkdir(output, {recursive:true});
let catalogue;
try {
  catalogue = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch('https://gym-drobe-backend.onrender.com/api/products', {signal:AbortSignal.timeout(60000)});
  assert.ok(response.ok);
  catalogue = (await response.json()).products;
  await fs.writeFile(cataloguePath, JSON.stringify(catalogue));
}
const tumbler = catalogue.find(product => product.id === '6ad26d85d8f991271e3d1fd3');
const bag = catalogue.find(product => product.id === '6ad26896d8f991271e3d1f99');
assert.ok(tumbler && bag, 'Approval fixture products must be present');
process.env.VITE_API_URL = 'http://127.0.0.1:4338/api';
const {startStorefrontFixture, mockStorefront} = await import(pathToFileURL(path.join(root,'tests/storefront-fixture.mjs')));
const fixture = await startStorefrontFixture(4338);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
  await mockStorefront(context, catalogue);
  await context.addInitScript(({tumbler,bag}) => {
    if (sessionStorage.getItem('review-seeded')) return;
    localStorage.setItem('gymdrobe-cart', JSON.stringify([{...tumbler, quantity:1, selectedColor:tumbler.colors[0], selectedSize:tumbler.sizes[0]}]));
    localStorage.setItem('gymdrobe-wishlist', JSON.stringify([bag.id]));
    sessionStorage.setItem('review-seeded','1');
  }, {tumbler,bag});
  const page = await context.newPage();
  const shot = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:path.join(output,name+'.png'), animations:'disabled'});
  };
  for (const [route,selector] of [['cart','.cart-row'],['wishlist','.gm-product-card'],['categories','.native-collection']]) {
    await page.goto(fixture.url+'/'+route);
    await page.locator(selector).first().waitFor();
    await shot(route);
    for (const width of [320,390,430,768,1440]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route+' overflow at '+width);
    }
    await page.setViewportSize({width:390,height:844});
  }
  await page.locator('.gn-menu-toggle').click();
  await shot('menu');
  await page.getByRole('button',{name:'Close menu'}).click();
  await page.locator('.athletic-search-toggle').click();
  await shot('search');
  await page.locator('.athletic-search-toggle').click();
  await page.getByRole('navigation',{name:'Shopping navigation'}).screenshot({path:path.join(output,'navigation.png')});
  await page.goto(fixture.url+'/shop');
  await page.getByRole('button',{name:'Help me choose products'}).click();
  await shot('needs');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await shot('budget');
  await page.locator('.gd-guide-budget input').fill('1500');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await shot('goal');
  await page.locator('.gd-guide-question-actions [type=submit]').click();
} finally {
  await browser.close();
  await fixture.server.close();
}

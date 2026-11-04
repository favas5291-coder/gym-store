// Isolated synthetic accounts only. No live identity, customer data or mutations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {startStorefrontFixture, mockStorefront, fixtureOrderId} from './storefront-fixture.mjs';
const {chromium, webkit} = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('test-results/account-dashboard');
await fs.mkdir(output, {recursive:true});
process.env.VITE_API_URL = 'http://127.0.0.1:4242/api';
const baseline = process.argv.includes('--before');
const restore = new Map();
let fixture;
const results = [];
// Capture the exact pre-change source with the same account fixture and browser.
// Only used in isolated CI. Always restore checkout files, including after failures.
try {
  if (baseline) for (const file of ['src/components/AccountLayout.jsx','src/pages/AccountPage.jsx','src/App.jsx','src/native/NativeShopping.jsx','src/native/shopping-navigation.css']) {
    restore.set(file, await fs.readFile(file));
    await fs.writeFile(file, execFileSync('git', ['show', `16099b56eb4601f66af8e5f322bad468b40c7283:${file}`]));
  }
  fixture = await startStorefrontFixture(4242);
  for (const engine of baseline ? [chromium] : [chromium, webkit]) {
    const browser = await engine.launch({headless:true});
    const errors = [];
    async function setup(width=390, options={}) {
      const c = await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      const mock = await mockStorefront(c, fixture.products, {signedIn:true,...options});
      const p = await c.newPage(); p.setDefaultTimeout(10000);
      p.on('pageerror', error => errors.push(error.message));
      return {c,p,mock};
    }
    async function visit(p, route='/account') {
      await p.goto(fixture.url + route);
      await p.getByRole('heading', {name:baseline ? 'Account' : 'Preview Customer',exact:true}).waitFor();
      if(!baseline) await p.locator('.gd-account-stats[aria-busy="false"]').waitFor();
    }
    try {
      for (const width of baseline ? [390,1440] : [320,375,390,430,768,1024,1440]) {
        const {c,p} = await setup(width);
        await visit(p);
        if (baseline) await p.waitForTimeout(500);
        if (!baseline) {
          assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`${engine.name()} ${width}px overflow`);
          assert.deepEqual(await p.locator('.gd-account-stats strong').allTextContents(),['1','1']);
          assert.equal(await p.locator('.admin-shortcuts, .gd-account-admin').count(),0,'Customer has no management entry');
          const actions = p.getByRole('navigation',{name:'Quick account actions'});
          assert.equal(await actions.getByRole('link').count(),4);
          for(const link of await actions.getByRole('link').all()) { const b=await link.boundingBox();assert.ok(b.width>=44&&b.height>=44); }
          for(const row of await p.locator('.gd-account-row').all()) {const b=await row.boundingBox();assert.ok(b.width>=44&&b.height>=44);}
          const nav = p.getByRole('navigation',{name:'Shopping navigation'});
          assert.equal(await nav.isVisible(),width<1024);
          if(width<1024) {
            assert.equal(await nav.getByRole('link',{name:'Account',exact:true}).getAttribute('aria-current'),'page');
            const boxes = await Promise.all((await nav.getByRole('link').all()).map(link=>link.boundingBox()));
            assert.ok(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))<2);
            for(const b of boxes)assert.ok(b.width>=44&&b.height>=44);
            await p.getByRole('button',{name:'Sign out',exact:true}).scrollIntoViewIfNeeded();
            const signout=await p.getByRole('button',{name:'Sign out',exact:true}).boundingBox();
            const navbox=await nav.boundingBox();assert.ok(signout.y+signout.height<=navbox.y,'Sign out remains above navigation');
          }
          await p.getByRole('link',{name:'Edit profile',exact:true}).click();
          assert.equal(await p.locator('#profile-details').getAttribute('open'),'');
          assert.equal(await p.getByLabel('Full name',{exact:true}).evaluate(el=>document.activeElement===el),true);
          assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Expanded form must fit');
          assert.ok(await p.getByLabel('Full name',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'Prevent iOS input zoom');
          await p.locator('#profile-details>summary').click();
          await p.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
          results.push(`${engine.name()}: ${width}px layout, data, touch targets, profile focus, navigation`);
        }
        if (engine===chromium || !baseline && width===390) {
          const prefix=baseline?'before':'after';
          await p.screenshot({path:path.join(output,`${prefix}-${engine.name()}-${width}.png`),fullPage:true});
          if(width===390 || width===1440)await p.screenshot({path:path.join(output,`${prefix}-${engine.name()}-${width}-viewport.png`)});
        }
        await c.close();
      }
      if (!baseline) {
        const {c,p,mock}=await setup();
        const profileUser={...mock.user};
        await c.route('**/api/auth/me', route=>route.fulfill({json:{success:true,user:profileUser}}));
        await c.route('**/api/auth/profile', async route=>{
          assert.equal(route.request().method(),'PUT');
          Object.assign(profileUser,route.request().postDataJSON());
          await route.fulfill({json:{success:true,user:profileUser,message:'Profile updated successfully.'}});
        });
        await visit(p);
        await p.getByRole('link',{name:'Edit profile',exact:true}).click();
        await p.getByLabel('Full name',{exact:true}).fill('Updated Preview');
        await p.getByRole('button',{name:'Save changes',exact:true}).click();
        await p.getByRole('heading',{name:'Updated Preview',exact:true}).waitFor();
        await p.reload();await p.getByRole('heading',{name:'Updated Preview',exact:true}).waitFor();
        for(const route of ['/orders','/addresses','/saved','/notifications','/help','/account/security']) {
          await p.goto(fixture.url+route);
          await p.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link',{name:'Account',exact:true}).waitFor();
          assert.equal(await p.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link',{name:'Account',exact:true}).getAttribute('aria-current'),'page',route);
          assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route);
        }
        await p.goto(fixture.url+'/wishlist');
        assert.equal(await p.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link',{name:'Wishlist',exact:true}).getAttribute('aria-current'),'page');
        await p.goto(fixture.url+'/account');await p.locator('.gd-account-stats[aria-busy="false"]').waitFor();
        await p.locator('.gd-account-order').first().click();await p.waitForURL(`**/orders/${fixtureOrderId}`);
        await p.goto(fixture.url+'/account#profile-details');await p.getByLabel('Full name',{exact:true}).waitFor();
        await p.getByLabel('Full name',{exact:true}).focus();
        await p.evaluate(()=>{
          Object.defineProperty(visualViewport,'height',{configurable:true,value:350});
          visualViewport.dispatchEvent(new Event('resize'));
        });
        await p.waitForTimeout(200);
        assert.equal(await p.getByRole('navigation',{name:'Shopping navigation'}).isVisible(),false,'Keyboard hides bottom navigation');
        await p.reload();await p.getByRole('button',{name:'Sign out',exact:true}).click();await p.waitForURL('**/login');
        assert.equal(await p.evaluate(()=>localStorage.getItem('gymdrobe-auth-token')),null);
        results.push(`${engine.name()}: profile save and refresh, account routes, order detail, deep link, keyboard, logout`);
        await c.close();

        const failure=await setup();let failing=true;
        await failure.c.route('**/api/orders',route=>route.fulfill({status:failing?503:200,json:failing?{message:'Orders are temporarily unavailable.'}:{success:true,orders:[]}}));
        await visit(failure.p);
        assert.deepEqual(await failure.p.locator('.gd-account-stats strong').allTextContents(),['—','1']);
        assert.equal(await failure.p.getByText("You haven't placed an order yet.",{exact:true}).count(),0);
        await failure.p.screenshot({path:path.join(output,`error-${engine.name()}-390.png`),fullPage:true});
        failing=false;await failure.p.getByRole('button',{name:'Retry account details',exact:true}).click();
        await failure.p.getByText("You haven't placed an order yet.",{exact:true}).waitFor();
        assert.deepEqual(await failure.p.locator('.gd-account-stats strong').allTextContents(),['0','1']);
        results.push(`${engine.name()}: partial failure keeps valid address data, honest counts, retry and empty state`);
        await failure.c.close();

        const admin=await setup();
        await admin.c.route('**/api/auth/me',route=>route.fulfill({json:{success:true,user:{...admin.mock.user,role:'admin'}}}));
        await visit(admin.p);
        assert.equal(await admin.p.locator('.admin-shortcuts').count(),0);
        assert.equal(await admin.p.locator('.gd-account-admin').count(),1);
        await admin.p.locator('.gd-account-admin').getByRole('link',{name:'Open admin'}).click();
        await admin.p.locator('.admin-shortcuts').waitFor();
        await admin.c.close();
        results.push(`${engine.name()}: authorized admin gets one separate entry; workspace controls remain`);
        assert.deepEqual(errors,[],'No uncaught browser errors');
      }
    } finally { await browser.close(); }
  }
} finally {
  if(fixture)await fixture.server.close();
  for(const [file,contents] of restore)await fs.writeFile(file,contents);
  await fs.writeFile(path.join(output,baseline?'before-results.json':'results.json'),JSON.stringify({baseline,results},null,2));
}
console.log(results.join('\n') || 'Before screenshots captured.');

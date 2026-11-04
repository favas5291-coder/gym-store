import assert from 'node:assert/strict';
import {startStorefrontFixture,mockStorefront} from './storefront-fixture.mjs';
const {chromium,webkit}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE||'playwright');
process.env.VITE_API_URL='http://127.0.0.1:4238/api';
const f=await startStorefrontFixture(4238);
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{const context=await browser.newContext();await mockStorefront(context,f.products);const page=await context.newPage();
 for(const width of [320,360,390,414,430,480,768,1024,1280]){
  await page.setViewportSize({width,height:844});await page.goto(f.url+'/categories');await page.getByRole('heading',{name:'Shop by category',exact:true}).waitFor();
  const nav=page.getByRole('navigation',{name:'Shopping navigation'});assert.equal(await nav.isVisible(),width<1024);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.getByRole('button',{name:'Search by photo',exact:true}).count(),0);
  if(width<1024){const links=await nav.getByRole('link').all();assert.equal(links.length,5);for(const link of links){const b=await link.boundingBox();assert.ok(b.width>=44&&b.height>=44);}assert.equal(await nav.getByRole('link',{name:'Categories',exact:true}).getAttribute('aria-current'),'page');}
 }
 await page.setViewportSize({width:390,height:844});
 for(const label of ['Home','Categories','Wishlist','Cart, 0 items','Account']){await page.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link',{name:label,exact:true}).click();await page.reload();assert.equal(await page.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link',{name:label,exact:true}).getAttribute('aria-current'),'page');}
 console.log(engine.name()+' free navigation passed');
 }finally{await browser.close();}
}}finally{await f.server.close();}

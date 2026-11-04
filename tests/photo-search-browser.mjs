// CI-only browser regression checks with explicit catalogue/search fixtures.
// These exercise UX contracts, not model relevance or physical-device permissions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startStorefrontFixture,mockStorefront,fixtureProductId} from './storefront-fixture.mjs';
const {chromium,webkit}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE||'playwright');
process.env.VITE_API_URL='http://127.0.0.1:4236/api';
const f=await startStorefrontFixture(4236),results=[];
await fs.mkdir('test-results/photo-search',{recursive:true});
try{
 for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});await mockStorefront(context,f.products);
  let available=true,mode='results',uploads=0;
  await context.route('**/api/visual-search/status',r=>r.fulfill({json:{available,maxBytes:8388608}}));
  await context.route('**/api/visual-search',r=>{uploads++;assert.equal(r.request().headers()['content-type'],'image/jpeg');return r.fulfill({status:mode==='failure'?503:200,json:mode==='failure'?{message:'Search fixture failed. Retry.'}:{products:mode==='empty'?[]:[f.products[0]],matchType:'visually-similar'}});});
  // Allow local image object URLs without permitting any external network request.
  await context.route('blob:**', r => r.continue());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(f.url+'/categories');await page.getByRole('heading',{name:'Shop by category',exact:true}).waitFor();
   for(const width of[320,360,390,414,430,480,768,1024,1280]){await page.setViewportSize({width,height:844});const nav=page.getByRole('navigation',{name:'Shopping navigation'});assert.equal(await nav.isVisible(),width<1024);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(width<1024){const boxes=await nav.getByRole('link').all();assert.equal(boxes.length,5);for(const link of boxes){const b=await link.boundingBox();assert.ok(b.width>=44&&b.height>=44);}}}
   await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Search by photo',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByText('Checking photo search availability…',{exact:true}).waitFor({state:'hidden'});
   await dialog.locator('input[type=file]').last().setInputFiles('src/assets/shoes.jpg');try { await dialog.getByRole('img',{name:'Selected search photo preview'}).waitFor(); } catch(error) { await page.screenshot({path:`test-results/photo-search/${name}-preview-failure.png`});throw new Error(`${name} preview failed: ${await dialog.innerText()} | page errors: ${JSON.stringify(errors)}`,{cause:error}); }await dialog.getByRole('button',{name:'Crop photo',exact:true}).click();await dialog.getByLabel('Zoom',{exact:true}).press('ArrowRight');
   await dialog.getByRole('button',{name:'Find similar products',exact:true}).click();await dialog.getByRole('heading',{name:'Visually similar products',exact:true}).waitFor();assert.equal(uploads,1);await page.screenshot({path:`test-results/photo-search/${name}-results.png`});
   mode='empty';await dialog.getByRole('button',{name:'Find similar products',exact:true}).click();await dialog.getByRole('heading',{name:'No close matches found. Try another photo or search by name.',exact:true}).waitFor();
   mode='failure';await dialog.getByRole('button',{name:'Find similar products',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.ok(await dialog.getByRole('button',{name:'Retry photo search',exact:true}).isEnabled());
   await dialog.getByRole('button',{name:'Remove',exact:true}).click();await dialog.getByRole('img',{name:'Selected search photo preview'}).waitFor({state:'detached'});assert.equal(await dialog.getByRole('img',{name:'Selected search photo preview'}).count(),0);await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
   available=false;await page.getByRole('button',{name:'Search by photo',exact:true}).click();await page.getByText('Photo search is not available yet. You can preview a photo, or search by name.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Find similar products',exact:true}).isEnabled(),false);await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   await page.goto(f.url+`/product/${fixtureProductId}`);await page.locator('#product-reviews').scrollIntoViewIfNeeded();await page.locator('.product-primary-actions.is-floating').waitFor();const bar=await page.locator('.product-primary-actions.is-floating').boundingBox(),nav=await page.getByRole('navigation',{name:'Shopping navigation'}).boundingBox();assert.ok(bar.y+bar.height<=nav.y+1);
   assert.deepEqual(errors,[]);results.push({engine:name,passed:true});
  }finally{await context.close();await browser.close();}
 }
}finally{await f.server.close();await fs.writeFile('test-results/photo-search/results.json',JSON.stringify(results,null,2));}

// Browser integration and visual checks against local fixtures only. No live payment is attempted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {startStorefrontFixture,mockStorefront,fixtureProductId,fixtureOrderId} from './storefront-fixture.mjs';
const {chromium}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || 'playwright');
const output=path.resolve(process.env.STOREFRONT_ARTIFACTS || 'test-results/storefront');
await fs.mkdir(output,{recursive:true});
const f=await startStorefrontFixture(Number(process.env.STOREFRONT_TEST_PORT || 4210));
const browser=await chromium.launch({headless:true,...(process.env.GYMDROBE_CHROMIUM_PATH?{executablePath:process.env.GYMDROBE_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[], errors=[];
const check=async(name,fn)=>{try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.message,stack:e.stack});console.error('FAIL',name,e.stack);}};
async function context(width=1440,options={}){
 const c=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce',...options.browser});
 const mock=await mockStorefront(c,options.catalogProducts || f.products,options);
 const p=await c.newPage();p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push({url:p.url(),message:e.message}));
 return {c,p,mock};
}
async function visit(p,route){await p.goto(f.url+route);await p.locator('main').waitFor();await p.waitForTimeout(350);}
async function capture(p,name){
 await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,45));}scrollTo(0,0);});
 await p.waitForTimeout(150);
 await p.screenshot({path:path.join(output,name+'.png'),fullPage:true});
 if(name.startsWith('home-'))await p.screenshot({path:path.join(output,name+'-viewport.png')});
}
async function choose(p){await p.getByRole('button',{name:'Colour Black',exact:true}).first().click();await p.getByRole('button',{name:'Size M',exact:true}).first().click();}
try{
 await check('Idle hints rotate once through purchasable categories without entering a query', async () => {
  const products = ['BAG', 'Compression T-shirt', 'Sneakers', 'Sold out'].map((category, index) => ({
    ...f.products[0], id: String(index + 1).padStart(24, '0'), _id: String(index + 1).padStart(24, '0'),
    category, stockStatus: index === 3 ? 'out-of-stock' : 'in-stock',
  }));
  const view = await context(390, {catalogProducts: products, browser: {reducedMotion: 'no-preference'}});
  const page = view.p;
  try {
   await view.c.addInitScript(() => localStorage.setItem('gymdrobe.web-opening.seen.v1','1'));
   await page.clock.install();
   await visit(page, '/');
   const term = page.locator('.gs-terms strong');
   await term.waitFor();
   const labels = [await term.innerText()];
   for (let index = 1; index < 3; index++) {
    await page.clock.fastForward(4010);
    labels.push(await term.innerText());
   }
   assert.deepEqual(labels, ['Compression T-shirts', 'Gym bags', 'Sneakers']);
   await page.clock.fastForward(10000);
   assert.equal(await term.innerText(), 'Sneakers');
   const field = page.getByRole('combobox', {name: 'Search products'});
   assert.equal(await field.inputValue(), '');
   await field.click();
   assert.equal(await term.count(), 0);
   assert.equal(await page.getByRole('option', {name: 'Sold out'}).count(), 0);
   await page.getByRole('option', {name:'Gym bags', exact:true}).click();
   await page.waitForURL(url => url.searchParams.get('category') === 'BAG');
   assert.equal(await page.evaluate(() => localStorage.getItem('gymdrobe-recent-searches')), null);
  } finally {await view.c.close();}
 });
 for (const width of [390, 1440]) {
  const view = await context(width);
  await check(`${width}px editorial cards, account contrast and guide`, async () => {
   await visit(view.p, '/');
   const featured = view.p.locator('#featured');
   await featured.scrollIntoViewIfNeeded();
   const card = featured.locator('.gm-product-card').first();
   assert.match(await card.innerText(), /₹/);
   assert.ok(await card.locator('h3').isVisible());
   await featured.screenshot({path:path.join(output, `athletic-${width}-featured.png`)});
   const categories = view.p.locator('.athletic-categories').first();
   assert.ok(await categories.locator('a').count() > 0);
   await categories.screenshot({path:path.join(output, `athletic-${width}-categories.png`)});
   assert.equal(await view.p.locator('.home-story, .home-spotlight, .home-new').count(), 0);
   await visit(view.p, '/login');
   assert.equal(await view.p.locator('.auth-banner h1').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
   await view.p.locator('.auth-card').screenshot({path:path.join(output, `refinement-${width}-account.png`)});
   await visit(view.p, '/shop');
   await view.p.getByRole('button', {name:'Help me choose products', exact:true}).click({timeout:20000});
   const guide = view.p.getByRole('dialog', {name:'Find your workout gear'});
   await guide.screenshot({path:path.join(output, `refinement-${width}-guide-categories.png`)});
   await guide.getByRole('button', {name:'Next', exact:true}).click();
   await guide.getByRole('button', {name:'₹1,000', exact:true}).click();
   await guide.screenshot({path:path.join(output, `refinement-${width}-guide-budget.png`)});
   assert.equal(await guide.getByRole('button',{name:'₹1,000',exact:true}).getAttribute('aria-pressed'), 'true');
   assert.ok(await guide.getByRole('button',{name:'Next',exact:true}).isVisible());
   await guide.getByRole('button',{name:'Close dialog'}).click();
  });
  await view.c.close();
 }
 // The same visible Home input serves touch and keyboard shoppers at every breakpoint.
 for (const width of [320,360,390,430,768,1024,1440]) {
  const searchUI=await context(width,{browser:{isMobile:width<=430,hasTouch:width<=430}});
  await searchUI.c.addInitScript(()=>{
   if (!localStorage.getItem('gymdrobe-recent-searches')) {
    localStorage.setItem('gymdrobe-recent-searches',JSON.stringify(['shoes','tshirt','gloves','gym bag','shaker','training']));
   }
  });
  await check(width+'px visible Home search, recent searches and keyboard navigation',async()=>{
   const page=searchUI.p;
   await visit(page,'/');
   const input=page.getByRole('combobox',{name:'Search products'});
   assert.equal(await input.count(),1);
   assert.equal(await input.getAttribute('aria-expanded'),'false');
   assert.equal(await input.evaluate(el=>el===document.activeElement),false);
   assert.equal(await page.getByRole('button',{name:'Open search',exact:true}).count(),0);
   const form=page.locator('.gn-form');
   if(width<1024){
    const field=await form.boundingBox();
    assert.ok(field.width>=width-36 && field.height>=47,JSON.stringify(field));
    assert.ok(parseFloat(await input.evaluate(el=>getComputedStyle(el).fontSize))>=16);
   }
   await input.click();
   const panel=page.locator('.gn-results');
   await panel.getByRole('option',{name:'shoes',exact:true}).waitFor();
   for(const term of ['shoes','tshirt','gloves','gym bag','shaker','training']){
    assert.equal(await panel.getByRole('option',{name:term,exact:true}).count(),1);
   }
   const field=await page.locator('.gs-input-row').boundingBox(), suggestions=await panel.boundingBox();
   assert.ok(suggestions.x>=-1 && suggestions.x+suggestions.width<=width+1,JSON.stringify(suggestions));
   assert.ok(suggestions.y>=field.y+field.height-1,JSON.stringify({field,suggestions}));
   if(width>=1024){
    assert.ok(Math.abs(suggestions.x-field.x)<=2 && Math.abs(suggestions.width-field.width)<=2,JSON.stringify({field,suggestions}));
   }
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await panel.waitFor({state:'hidden'});
   assert.ok(await page.getByRole('button',{name:'Focus search',exact:true}).evaluate(el=>el===document.activeElement));
   await input.click();
   await input.press('ArrowDown');
   assert.equal(await input.getAttribute('aria-activedescendant'),await panel.getByRole('option',{name:'shoes',exact:true}).getAttribute('id'));
   await input.press('Enter');
   await page.waitForURL(/\/shop\?search=shoes/);
   await visit(page,'/');
   await input.fill('gym');
   await input.press('Enter');
   await page.waitForURL(/\/shop\?search=gym/);
  });await searchUI.c.close();
 }
 const keyboardUI=await context(390,{browser:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}});
 await keyboardUI.c.addInitScript(()=>localStorage.setItem('gymdrobe-recent-searches',JSON.stringify(['shoes','gloves','training','shaker','yoga','bag'])));
 await check('390px keyboard viewport, removable history and a shoppable product suggestion',async()=>{
  const page=keyboardUI.p;
  await visit(page,'/');
  const input=page.getByRole('combobox',{name:'Search products'});
  await input.click();
  // A controlled visual viewport tests keyboard geometry reproducibly in headless Chrome.
  await page.evaluate(()=>{
   Object.defineProperty(visualViewport,'height',{configurable:true,value:340});
   visualViewport.dispatchEvent(new Event('resize'));
  });
  const panel=page.locator('.gn-results');
  await page.waitForFunction(()=>{
   const rect=document.querySelector('.gn-results')?.getBoundingClientRect();
   return rect && rect.bottom<=visualViewport.offsetTop+visualViewport.height+1 && rect.height>=44;
  });
  const first=await panel.getByRole('option').first().boundingBox();
  assert.ok(first.y+first.height<=341,JSON.stringify(first));
  await page.getByRole('button',{name:'Remove shoes',exact:true}).click();
  assert.equal(await panel.getByRole('option',{name:'shoes',exact:true}).count(),0);
  await page.getByRole('button',{name:'Clear all',exact:true}).click();
  await panel.getByRole('option').first().waitFor();
  assert.equal(await panel.getByRole('option',{name:'gloves',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gymdrobe-recent-searches')||'[]').length),0);
  await input.fill('shoes');
  await input.fill('black gym tee');
  const product=panel.locator('a[role="option"][href^="/product/"]').filter({hasText:'Gym Training T-Shirt'});
  await product.waitFor();
  const productHref=await product.getAttribute('href');
  assert.equal(productHref,'/product/'+fixtureProductId);
  assert.match(await product.innerText(),/₹/);
  await product.locator('img').evaluate(img=>img.decode());
  const box=await product.boundingBox();
  assert.ok(box.y+box.height<=341,JSON.stringify(box));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gymdrobe-recent-searches')||'[]').length),0);
  await product.click();
  await page.waitForURL('**'+productHref);
  await page.getByRole('heading',{name:'Gym Training T-Shirt',exact:true}).waitFor();
  assert.equal(keyboardUI.mock.requests.filter(r=>r.path==='/api/products' && r.method==='GET').length,1);
 });await keyboardUI.c.close();
 const recovery=await context(390,{browser:{isMobile:true,hasTouch:true}});
 await check('Search Retry preserves the query and recovers real suggestions',async()=>{
  let attempts=0;
  await recovery.c.route('**/api/products',async route=>{
   attempts++;
   if(attempts===1) {
    return route.fulfill({status:503,json:{success:false,message:'Catalogue unavailable'}});
   }
   return route.fallback();
  });
  await visit(recovery.p,'/');
  const input=recovery.p.getByRole('combobox',{name:'Search products'});
  await input.fill('black gym tee');
  const panel=recovery.p.locator('.gn-results');
  const retry=panel.getByRole('button',{name:/retry/i});
  await retry.waitFor();
  assert.equal(attempts,1);
  await retry.click();
  await panel.locator('a[role="option"][href^="/product/"]').filter({hasText:'Gym Training T-Shirt'}).waitFor();
  assert.equal(await input.inputValue(),'black gym tee');
  assert.equal(attempts,2);
 });await recovery.c.close();
 const historyProducts=Array.from({length:12},(_,i)=>{
  const id=String(i+1).padStart(24,'0');
  return {...f.products[0],id,_id:id,name:'Black training tee '+(i+1)};
 });
 const history=await context(390,{catalogProducts:historyProducts,browser:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}});
 await check('Back from a product restores the exact search, filters, sort and results position',async()=>{
  const page=history.p;
  const params=new URLSearchParams({search:'black gym tee',category:'Workout Clothes',sort:'price-low'});
  const resultsURL=f.url+'/shop?'+params;
  await page.goto(resultsURL);
  const product=page.locator('.shop-results .gm-product-info-link').nth(5);
  await product.waitFor();
  await product.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForFunction(()=>window.scrollY>200);
  const offset=await page.evaluate(()=>window.scrollY);
  const title=await product.innerText();
  await product.click();
  await page.getByRole('heading',{name:title.trim(),exact:true}).waitFor();
  await page.goBack();
  await page.waitForURL(resultsURL);
  await product.waitFor();
  await page.waitForFunction(y=>Math.abs(window.scrollY-y)<=3,offset);
  assert.equal(await page.getByLabel('Sort by:').inputValue(),'price-low');
  await page.getByRole('button',{name:'Open search',exact:true}).click();
  assert.equal(await page.getByRole('combobox',{name:'Search products'}).inputValue(),'black gym tee');
 });await history.c.close();
 // The detail hero should not letterbox square or landscape photos inside
 // a fixed portrait frame. No image pixels may be cropped to achieve the fill.
 for (const width of [320,360,375,390,430,768,1024,1440]) {
  const galleryUI=await context(width,{browser:{isMobile:width<=430,hasTouch:width<=430}});
  await check(width+'px product gallery fills media column without cropping',async()=>{
   await visit(galleryUI.p,`/product/${fixtureProductId}`);
   const hero=galleryUI.p.locator('.gd-color-gallery > .main-photo');
   const photo=hero.locator('img');
   await photo.waitFor({state:'visible'});
   await galleryUI.p.waitForFunction(()=>{
    const el=document.querySelector('.gd-color-gallery > .main-photo > img');
    return el && el.complete && el.naturalWidth>0 && el.naturalHeight>0;
   });
   await galleryUI.p.waitForTimeout(80);
   const info=await hero.evaluate(el=>{
    const img=el.querySelector('img'),rect=el.getBoundingClientRect();
    const page=document.querySelector('.product-page').getBoundingClientRect();
    const thumb=document.querySelector('.gd-color-gallery .thumbnails');
    const computed=getComputedStyle(img),frameStyle=getComputedStyle(el);
    return {frame:{x:rect.x,width:rect.width,height:rect.height,top:rect.top,bottom:rect.bottom},
      page:{x:page.x,width:page.width},orientation:el.dataset.galleryOrientation,
      sourceRatio:img.naturalWidth/img.naturalHeight,
      frameRatio:rect.width/rect.height,objectFit:computed.objectFit,
      naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
      imgWidth:img.getBoundingClientRect().width,
      thumbBelow:!thumb||thumb.getBoundingClientRect().top>=rect.bottom-1,
      documentWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.ok(info.thumbBelow,'Thumbnails stay below main photo '+JSON.stringify(info));
   assert.ok(info.documentWidth<=width+1,'No horizontal overflow '+JSON.stringify(info));
   assert.equal(info.objectFit,'contain','Never crop or distort product detail photography');
   if(width<=700){
    assert.ok(info.frame.width>=width-2,'Image fills mobile viewport '+JSON.stringify(info));
    assert.ok(info.frame.x>=-1 && info.frame.x<=1,'Mobile hero aligned to screen edges '+JSON.stringify(info));
    const safeRatio=Math.min(1.6,Math.max(.7,info.sourceRatio));
    assert.ok(Math.abs(info.frameRatio-safeRatio)<.03,'Photo frame matches image shape '+JSON.stringify(info));
   }else{
    assert.ok(info.frame.width<width*.72,'Desktop/tablet product gallery remains in its column');
   }
  });await galleryUI.c.close();
 }
 // The baseline catalogue has one photo per colour. Supply a second
 // authentic bundled image to this isolated fixture to exercise thumbnails.
 const firstProduct=f.products[0];
 const firstColour=firstProduct.colorImages[0];
 const galleryProductFixture={
  ...firstProduct,
  colorImages:firstProduct.colorImages.map((row,index)=>index===0
   ? {...row,images:[row.images[0],firstProduct.images.find(image=>image!==row.images[0])].filter(Boolean)}
   : row),
 };
 const galleryChoice=await context(390,{browser:{isMobile:true,hasTouch:true},
  catalogProducts:[galleryProductFixture,...f.products.slice(1)]});
 await check('390px gallery thumbnails, variant image switching and zoom remain working',async()=>{
  await visit(galleryChoice.p,`/product/${fixtureProductId}`);
  const gallery=galleryChoice.p.locator('.gd-color-gallery');
  const thumbs=gallery.locator('.thumbnails button');
  assert.ok(await thumbs.count()>1,'Fixture has multiple product images');
  await thumbs.nth(1).click();
  assert.equal(await thumbs.nth(1).getAttribute('aria-pressed'),'true');
  const secondSrc=await gallery.locator('.main-photo img').getAttribute('src');
  assert.ok(secondSrc,'Selected image visible');
  await gallery.getByRole('button',{name:/Enlarge .* image/}).click();
  const zoom=galleryChoice.p.getByRole('dialog');
  await zoom.waitFor();
  assert.ok(await zoom.locator('img').count()>0,'Zoom shows active image');
  await galleryChoice.p.keyboard.press('Escape');
  await zoom.waitFor({state:'hidden'});
  await galleryChoice.p.getByRole('button',{name:'Colour White',exact:true}).first().click();
  await galleryChoice.p.waitForFunction(()=>{
    const el=document.querySelector('.gd-color-gallery .main-photo img');
    return !!el && el.complete && el.naturalWidth>0;
  });
  assert.ok(await gallery.locator('.main-photo img').getAttribute('src'));
 });await galleryChoice.c.close();
 const offers = await context(390);
 await check('Offers preserve the chosen coupon and defer delivery eligibility to the bag quote', async () => {
  const { p } = offers;
  await visit(p, '/offers');
  const useCoupon = p.getByRole('button', {name: 'Use coupon GYM10', exact: true});
  await useCoupon.click();
  await p.reload();
  await useCoupon.waitFor();
  assert.equal(await useCoupon.getAttribute('aria-pressed'), 'true');
  const offerText = await p.locator('main').innerText();
  assert.match(offerText, /delivery pincode/i);
  assert.doesNotMatch(offerText, /delivery becomes free at/i);
  await p.getByRole('link', {name: 'Review your bag'}).click();
  await p.waitForURL('**/cart');
 });
 await offers.c.close();
 const collectionCategory = "Compression T-shirt";
 const collection = await context(390, { catalogProducts: [
  { ...f.products[0], category: collectionCategory },
  { ...f.products[1], category: "Joggers" },
 ] });
 await check('Canonical category navigation scopes the catalogue and keeps filters out of search',async()=>{
  const { p } = collection;
  await visit(p,'/shop');
  await p.getByRole('navigation',{name:'Shop by category'}).getByRole('link',{name:'Compression T-shirts'}).click();
  await p.waitForURL('**/collections/compression-t-shirts');
  await p.getByRole('heading',{name:'Compression T-shirts',exact:true}).waitFor();
  await p.locator('.product-grid .gm-product-card').first().waitFor();
  assert.equal(await p.locator('.product-grid .gm-product-card').count(),1);
  assert.equal(await p.getByRole('link',{name:'Categories',exact:true}).last().getAttribute('aria-current'),'page');
  assert.match(await p.locator('link[rel=canonical]').getAttribute('href'),/\/collections\/compression-t-shirts$/);
  assert.equal(await p.locator('meta[name=robots]').getAttribute('content'),'index, follow');
  await p.getByLabel('Sort by:').selectOption('price-low');
  await p.waitForURL('**/collections/compression-t-shirts?sort=price-low');
  await p.waitForFunction(()=>document.querySelector('meta[name=robots]')?.content==='noindex, follow');
  await p.goBack();
  await p.waitForURL('**/collections/compression-t-shirts');
  await p.reload();
  await p.getByRole('heading',{name:'Compression T-shirts',exact:true}).waitFor();
  await p.goto(f.url+'/shop?category=Compression+T-shirt');
  await p.waitForFunction(()=>document.querySelector('link[rel=canonical]')?.href.endsWith('/collections/compression-t-shirts'));
 });await collection.c.close();
 const x=await context();
 await check('Search and URL-preserving catalog filters',async()=>{
  await visit(x.p,'/');
  const search=x.p.getByRole('combobox',{name:'Search products'});
  await search.fill('shoes');await search.press('Enter');await x.p.waitForURL('**/shop?**');
  await x.p.locator('.product-grid .gm-product-card').first().waitFor();assert.match(x.p.url(),/search=shoes/);
  await x.p.waitForFunction(()=>document.querySelectorAll('.product-grid .gm-product-card').length===1);assert.equal(await x.p.locator('.product-grid .gm-product-card').count(),1);
  await visit(x.p,'/shop');await x.p.getByRole('checkbox',{name:/Workout Clothes/}).first().click();
  await x.p.waitForURL(/category=/);await x.p.waitForFunction(()=>document.querySelectorAll('.product-grid .gm-product-card').length===1);assert.equal(await x.p.locator('.product-grid .gm-product-card').count(),1);
  await x.p.getByLabel('Sort by:').selectOption('price-low');await x.p.waitForURL(/sort=price-low/);
  await x.p.reload();await x.p.getByRole('checkbox',{name:/Workout Clothes/}).first().waitFor();assert.equal(await x.p.getByRole('checkbox',{name:/Workout Clothes/}).first().isChecked(),true);
 });
 await check('Product colour imagery, balanced actions, wishlist and cart quantity',async()=>{
  await visit(x.p,`/product/${fixtureProductId}`);
  await choose(x.p);
  const before=await x.p.locator('.gallery .main-photo img').getAttribute('src');
  await x.p.getByRole('button',{name:'Colour White',exact:true}).click();
  await x.p.waitForFunction(previous=>document.querySelector('.gallery .main-photo img')?.getAttribute('src')!==previous,before);const after=await x.p.locator('.gallery .main-photo img').getAttribute('src');assert.notEqual(before,after);
  await choose(x.p);
  const sizes=await x.p.locator('.product-primary-actions .button').evaluateAll(els=>els.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  assert.ok(Math.abs(sizes[0].width-sizes[1].width)<1);assert.equal(sizes[0].height,sizes[1].height);
  await x.p.getByRole('button',{name:'Save to wishlist',exact:true}).click();
  await x.p.getByRole('button',{name:/Add to (Cart|Bag)/i}).first().click();await x.p.getByText('✓ Added to your bag').waitFor();
  await visit(x.p,'/wishlist');await x.p.getByRole('heading',{name:'Gym Training T-Shirt'}).waitFor();
  await visit(x.p,'/cart');const qty=x.p.getByRole('combobox',{name:'Quantity for Gym Training T-Shirt'});await qty.selectOption('2');
  await x.p.reload();await qty.waitFor();assert.equal(await qty.inputValue(),'2');await capture(x.p,'cart-desktop');
 });
 await check('Guest checkout validation, delivery persistence, COD totals and coupon controls',async()=>{
  if(!await x.p.getByRole('combobox',{name:'Quantity for Gym Training T-Shirt'}).count()){await visit(x.p,`/product/${fixtureProductId}`);await choose(x.p);await x.p.getByRole('button',{name:/Add to (Cart|Bag)/i}).first().click();await x.p.getByText('✓ Added to your bag').waitFor();await visit(x.p,'/cart');await x.p.getByRole('combobox',{name:'Quantity for Gym Training T-Shirt'}).selectOption('2');}
  await visit(x.p,'/checkout');await x.p.getByLabel('Pincode',{exact:true}).fill('673001');
  const pay=x.p.locator('.gd-checkout-pay');await x.p.waitForFunction(()=>{const b=document.querySelector('.gd-checkout-pay');return b&&!b.disabled;});
  await pay.click();await x.p.getByText('Correct the highlighted delivery details.',{exact:true}).waitFor();assert.ok(await x.p.locator('[aria-invalid="true"]').count()>0);
  for(const [name,value] of Object.entries({fullName:'Preview Customer',email:'preview@example.test',phone:'9876543210',addressLine:'12 Preview Street',city:'Kozhikode',state:'Kerala'}))await x.p.locator(`input[name="${name}"]`).fill(value);
  await x.p.reload();await x.p.getByLabel('Full name',{exact:true}).waitFor();assert.equal(await x.p.getByLabel('Full name',{exact:true}).inputValue(),'Preview Customer');
  await x.p.getByRole('radio',{name:/COD with 10% advance/}).check();await x.p.waitForTimeout(550);assert.match(await x.p.locator('.price-summary').innerText(),/₹143\.80/);
  assert.ok(await x.p.locator('.gd-checkout-coupon summary').count());await capture(x.p,'checkout-desktop');
  assert.equal(x.mock.requests.filter(r=>r.path==='/api/payments/razorpay/order'||r.path==='/api/payments/razorpay/verify').length,0);
 });
 await x.c.close();
 const smartAddress=await context(390,{signedIn:true});
 await smartAddress.c.route('https://api.postalpincode.in/**',route=>route.fulfill({
  status:200,contentType:'application/json',
  headers:{'access-control-allow-origin':'*'},
  body:JSON.stringify([{Status:'Success',PostOffice:[
   {Name:'Kozhikode',District:'Kozhikode',State:'Kerala',Pincode:'673585'},
   {Name:'Koduvally',District:'Kozhikode',State:'Kerala',Pincode:'673585'}
  ]}])
 }));
 await check('390px accessible city/state and multi-locality PIN autocomplete preserves saved addresses',async()=>{
  await visit(smartAddress.p,'/addresses');
  await smartAddress.p.getByRole('button',{name:'Edit',exact:true}).first().click();
  const dialog=smartAddress.p.getByRole('dialog');
  const city=dialog.getByRole('combobox',{name:'City'});
  const state=dialog.getByRole('combobox',{name:'State'});
  await city.fill('Koz');
  await dialog.getByRole('option',{name:/Kozhikode.*Kerala/}).first().click();
  assert.equal(await city.inputValue(),'Kozhikode');
  await state.fill('Ker');
  await dialog.getByRole('option',{name:'Kerala'}).click();
  assert.equal(await state.inputValue(),'Kerala');
  await dialog.getByLabel('Pincode',{exact:true}).fill('673585');
  await dialog.getByText('Koduvally',{exact:true}).waitFor({timeout:12000});
  await dialog.getByRole('option',{name:/Koduvally.*Kozhikode/}).click();
  assert.equal(await city.inputValue(),'Koduvally');
  assert.equal(await state.inputValue(),'Kerala');
  assert.equal(await city.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),true);
  assert.ok(await dialog.getByRole('button',{name:'Update address',exact:true}).isEnabled());
 });await smartAddress.c.close();
 const saved=await context(390,{signedIn:true});
 await check('Saved address edit persists through API refresh',async()=>{await visit(saved.p,'/addresses');await saved.p.getByRole('button',{name:'Edit',exact:true}).first().click();const dialog=saved.p.getByRole('dialog');await dialog.getByLabel('House number, building and street',{exact:true}).fill('24 Updated Preview Street');await dialog.getByRole('button',{name:'Update address',exact:true}).click();await dialog.waitFor({state:'hidden'});await saved.p.reload();await saved.p.getByText('24 Updated Preview Street',{exact:false}).waitFor();assert.ok(saved.mock.requests.some(r=>r.method==='PUT'&&r.path.startsWith('/api/addresses/')));});await saved.c.close();
 const quick=await context();
 await check('Quick add retains card colour and validates variants',async()=>{
  await visit(quick.p,'/shop');await quick.p.getByRole('button',{name:'Preview White Gym Training T-Shirt'}).click();
  await quick.p.getByRole('button',{name:'Quick add Gym Training T-Shirt'}).click();const modal=quick.p.getByRole('dialog');await modal.waitFor();
  await modal.getByRole('button',{name:'Colour White',exact:true}).waitFor();assert.equal(await modal.getByRole('button',{name:'Colour White',exact:true}).getAttribute('aria-pressed'),'true');
  await modal.getByRole('button',{name:'Size M',exact:true}).click();await modal.getByRole('button',{name:/Add to (Cart|Bag)/i}).click();await modal.waitFor({state:'hidden'});
 });await quick.c.close();
 const reviewer=await context(390,{signedIn:true});
 await check('Review form remains accessible in its compact disclosure',async()=>{
  await visit(reviewer.p,`/product/${fixtureProductId}`);await reviewer.p.locator('.review-compose>summary').click();
  await reviewer.p.getByLabel('Your review',{exact:true}).fill('Review draft for the browser check.');
  assert.equal(await reviewer.p.getByLabel('Your review',{exact:true}).inputValue(),'Review draft for the browser check.');
  assert.ok(await reviewer.p.getByRole('button',{name:'Submit review',exact:true}).isEnabled());
 });await reviewer.c.close();
 const buy=await context(390);
 await check('Mobile menu, filter drawer, pincode and Buy Now',async()=>{
  await visit(buy.p,'/');await buy.p.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link',{name:'Categories',exact:true}).click();await buy.p.getByRole('heading',{name:'Shop by category',exact:true}).waitFor();
  await visit(buy.p,'/shop');await buy.p.getByRole('button',{name:'Filters',exact:true}).click();await buy.p.getByRole('dialog').waitFor();await buy.p.keyboard.press('Escape');
  await visit(buy.p,`/product/${fixtureProductId}`);await choose(buy.p);
  const pin=buy.p.locator('.delivery-pincode input');if(await pin.count()){await pin.fill('12');await pin.press('Enter');assert.ok(await buy.p.locator('.delivery-pincode [aria-invalid="true"]').count());await pin.fill('673001');await pin.press('Enter');}
  await buy.p.locator('#product-reviews').scrollIntoViewIfNeeded();await buy.p.locator('.product-primary-actions.is-floating').waitFor();const actions=await buy.p.locator('.product-primary-actions').boundingBox();assert.ok(actions.y+actions.height<=960,'Mobile purchase controls stay inside the viewport');
  await buy.p.evaluate(()=>scrollTo(0,0));await buy.p.waitForFunction(()=>!document.querySelector('.product-primary-actions.is-floating'));
  await buy.p.locator('#product-reviews').scrollIntoViewIfNeeded();await buy.p.locator('.product-primary-actions.is-floating').waitFor();
  await buy.p.getByRole('button',{name:'Buy Now',exact:true}).click();await buy.p.waitForURL('**/checkout?mode=buy-now');
  await buy.p.getByLabel('Pincode',{exact:true}).fill('673001');await buy.p.waitForTimeout(450);await capture(buy.p,'checkout-mobile');
 });await buy.c.close();
 for(const width of [320,390,768,1440]){
  const v=await context(width,{signedIn:true});
  const routes=[['home','/'],['shop','/shop'],['product',`/product/${fixtureProductId}`],['account','/account'],['addresses','/addresses'],['orders','/orders'],['order',`/orders/${fixtureOrderId}`],['tracking',`/orders/${fixtureOrderId}/track`],['success',`/order-success?orderId=${fixtureOrderId}`],['returns',`/orders/${fixtureOrderId}/return`],['help','/help'],['kits','/kits']];
  for(const [name,route]of routes)await check(`${width}px ${name}: layout and rendered state`,async()=>{
   await visit(v.p,route);await v.p.waitForTimeout(150);
   assert.ok(await v.p.locator('main h1,main h2,main .page-heading').count(), 'Page heading is present');
   const dimensions=await v.p.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(dimensions.page<=dimensions.viewport+1,JSON.stringify(dimensions));
   if([390,1440].includes(width)||(width===768&&name==='home'))await capture(v.p,`${name}-${width}`);
  });await v.c.close();
 }
 for(const [name,options,route,pattern]of [['empty',{empty:true},'/shop',/no (matching )?products/i],['catalog-error',{catalogFailure:true},'/shop',/Unable to load products/i],['empty-cart',{},'/cart',/bag|cart/i],['login',{},'/login',/sign in|log in|welcome/i],['out-of-stock',{},'/product/000000000000000000000006',/Out of stock/i]]){
  const v=await context(390,options);await check(name,async()=>{await visit(v.p,route);await v.p.waitForTimeout(400);assert.match(await v.p.locator('main').innerText(),pattern);await capture(v.p,name);});await v.c.close();
 }

 for(const width of [320,375,390,430,768,1024,1440,1920]){
  const v=await context(width);
  await check(width+'px merchandising and responsive navigation',async()=>{
   await visit(v.p,'/');
   await v.p.locator('.athletic-category-grid a').first().waitFor({state:'visible'});
   assert.ok(await v.p.getByRole('combobox',{name:'Search products'}).isVisible());
   assert.ok(await v.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width<1024) assert.deepEqual(await v.p.getByRole('navigation',{name:'Shopping navigation'}).getByRole('link').allTextContents(),['Home','Categories','Wishlist','Cart','Account']);
  });await v.c.close();
 }
 await check('Returning athletic homepage shows the first department action in the mobile viewport and opens real shopping routes', async () => {
  const view = await context(390, { browser: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  try {
   await view.p.addInitScript(() => localStorage.setItem('gymdrobe.web-opening.seen.v1', '1'));
   await visit(view.p, '/');
   const heading = view.p.getByRole('heading', { name: /gear for every workout/i });
   assert.ok(await heading.isVisible());
   assert.equal(await view.p.locator('.gs-idle-hint').getAttribute('aria-hidden'), 'true');
   const tiles = view.p.locator('.department-tile');
   assert.deepEqual(await tiles.allTextContents(), ['Women’s','Men’s']);
   const firstAction = await tiles.first().locator('span').boundingBox();
   const navigation = await view.p.getByRole('navigation', { name: 'Shopping navigation' }).boundingBox();
   assert.ok(firstAction.y + firstAction.height <= navigation.y);
   await view.p.screenshot({path:path.join(output,'campaign-390-first.png')});
   await tiles.last().scrollIntoViewIfNeeded();
   await view.p.screenshot({path:path.join(output,'campaign-390-men.png')});
   for (const gender of ['Women','Men']) {
    const tile = view.p.getByRole('link', {name:gender+'’s',exact:true});
    await tile.locator('img').evaluate(image => image.decode());
    await tile.focus();
    await tile.press('Enter');
    await view.p.waitForURL('**/shop?gender='+gender);
    await visit(view.p, '/');
   }
   await visit(view.p, '/');
   const category = view.p.locator('.athletic-category-grid a').first();
   const route = await category.getAttribute('href');
   await category.click();
   await view.p.waitForURL(url => url.pathname + url.search === route);
  } finally {
   await view.c.close();
  }
 });
 for (const width of [390, 1440]) {
  const view = await context(width, { browser: { reducedMotion: 'no-preference' } });
  await check(width + 'px home loads a static hero and makes zero video requests', async () => {
   const videoRequests = [];
   view.p.on('request', request => {
    if (request.resourceType() === 'media' || /\.(mp4|webm|m3u8)(?:[?#]|$)/i.test(request.url())) {
     videoRequests.push(request.url());
    }
   });
   await visit(view.p, '/');
   await view.p.locator('.athletic-category-grid img').first().evaluate(image => image.decode());
   await view.p.waitForLoadState('networkidle');
   assert.equal(await view.p.locator('main video').count(), 0);
   assert.deepEqual(videoRequests, []);
  });
  await view.c.close();
 }
 await check('Premium controls use Lucide SVG arrows and preserve shopping action semantics',async()=>{
  const shop=await context(390,{signedIn:true});
  try{
   await visit(shop.p,'/');
   const cta=shop.p.locator('.athletic-category-grid a').first();
   assert.ok(await cta.evaluate(el=>el.getBoundingClientRect().height>=44));
   await visit(shop.p,'/shop');
   const quick=shop.p.getByRole('button',{name:'Quick add Gym Training T-Shirt'}).first();
   await quick.waitFor();
   assert.ok(await quick.locator('svg.premium-control-arrow').count()>0);
   await quick.click();
   await shop.p.getByRole('dialog').waitFor();
  }finally{await shop.c.close();}
 });
 const policies=await context();
 await check('Existing policy URLs and keyboard focus',async()=>{for(const route of ['/shipping-and-returns.html','/virtual-try-on-privacy.html']){await policies.p.goto(f.url+route);assert.equal(await policies.p.locator('h1').count(),1);await policies.p.keyboard.press('Tab');assert.notEqual(await policies.p.evaluate(()=>document.activeElement.tagName),'BODY');}});await policies.c.close();
 await check('No browser runtime exceptions',async()=>assert.deepEqual(errors,[]));
}finally{
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({conditions:'Local Vite dev server; Chromium; test-only catalog, address, quote and order fixtures; third-party services blocked; no live payments',results,errors},null,2));
 await browser.close();await f.server.close();
}
if(results.some(r=>!r.passed))process.exitCode=1;


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
 // Search must remain compact and attached to the input across iPhone, tablet and desktop.
 for (const width of [320,375,390,430,768,1024,1440]) {
  const searchUI=await context(width,{browser:{isMobile:width<=430,hasTouch:width<=430}});
  await searchUI.c.addInitScript(()=>{
   localStorage.setItem('gymdrobe-recent-searches',JSON.stringify([
    'shoes','tshirt','gloves','gym bag','shaker','training'
   ]));
  });
  await check(width+'px premium search focus, compact history and selection',async()=>{
   await visit(searchUI.p,'/');
   const input=searchUI.p.getByRole('combobox',{name:'Search products'});
   await input.click();
   const dropdown=searchUI.p.locator('.gn-results');
   await dropdown.waitFor();
   const rowCount=await dropdown.locator('li').count();
   assert.equal(rowCount,6,'All saved searches remain available');
   const bounds=await searchUI.p.evaluate(()=>{
    const field=document.querySelector('.gn-form').getBoundingClientRect();
    const panel=document.querySelector('.gn-results').getBoundingClientRect();
    const input=document.querySelector('.gn-form input');
    const list=document.querySelector('.gn-results ul');
    return {field:{x:field.x,width:field.width,bottom:field.bottom},panel:{x:panel.x,width:panel.width,top:panel.top,height:panel.height,bottom:panel.bottom},fontSize:parseFloat(getComputedStyle(input).fontSize),
      outline:getComputedStyle(input).outlineStyle,viewport:innerWidth,listScroll:list.scrollHeight>list.clientHeight,
      focusBorder:getComputedStyle(document.querySelector('.gn-form')).borderTopColor};
   });
   assert.ok(Math.abs(bounds.panel.x-bounds.field.x)<=1.5,JSON.stringify(bounds));
   assert.ok(Math.abs(bounds.panel.width-bounds.field.width)<=2,JSON.stringify(bounds));
   assert.ok(Math.abs(bounds.panel.top-bounds.field.bottom)<=1.5,JSON.stringify(bounds));
   assert.ok(bounds.panel.x>=-1&&bounds.panel.x+bounds.panel.width<=width+1,JSON.stringify(bounds));
   assert.ok(bounds.panel.height<=312,JSON.stringify(bounds));
   assert.equal(bounds.outline,'none','No stacked native input outline');
   if(width<=1279)assert.ok(bounds.fontSize>=16,'Prevent iOS input zoom');
   assert.ok(bounds.listScroll,'Six recent searches must scroll in a compact panel');
   assert.equal(await dropdown.locator('svg').count()>0,true,'Use vector icons');
   await searchUI.p.getByRole('button',{name:'Done'}).click();
   assert.equal(await dropdown.count(),0);
   assert.equal(await input.evaluate(el=>el===document.activeElement),false);
   await input.click();
   await searchUI.p.locator('.gn-option').first().click();
   await searchUI.p.waitForURL(/\/shop\?search=shoes/);
   await visit(searchUI.p,'/');
   await input.fill('gym');
   await input.press('Enter');
   await searchUI.p.waitForURL(/\/shop\?search=gym/);
  });await searchUI.c.close();
 }
 const keyboardUI=await context(390,{browser:{isMobile:true,hasTouch:true}});
 await keyboardUI.c.addInitScript(()=>localStorage.setItem('gymdrobe-recent-searches',JSON.stringify(['shoes','gloves','training','shaker','yoga','bag'])));
 await check('390px iOS keyboard-sized viewport, outside dismissal and clear history',async()=>{
  await visit(keyboardUI.p,'/');
  const input=keyboardUI.p.getByRole('combobox',{name:'Search products'});
  await input.click();
  // Simulate the shrinking visualViewport that iOS provides when keyboard opens.
  await keyboardUI.p.evaluate(()=>{
   const vv=window.visualViewport;
   if(vv){
    Object.defineProperty(vv,'height',{configurable:true,value:340});
    vv.dispatchEvent(new Event('resize'));
   }
  });
  await keyboardUI.p.waitForTimeout(120);
  const geometry=await keyboardUI.p.evaluate(()=>{
   const vv=window.visualViewport;
   const panel=document.querySelector('.gn-results').getBoundingClientRect();
   return {bottom:panel.bottom,visibleBottom:vv.offsetTop+vv.height,height:panel.height};
  });
  assert.ok(geometry.bottom<=geometry.visibleBottom+1,JSON.stringify(geometry));
  assert.ok(geometry.height>45 && geometry.height<=290,JSON.stringify(geometry));
  await keyboardUI.p.getByRole('button',{name:'Clear history'}).click();
  assert.equal(await keyboardUI.p.locator('.gn-results li').count(),0);
  assert.equal(await keyboardUI.p.locator('.gn-results').count(),1);
  await keyboardUI.p.locator('.theme-category-grid').click({position:{x:10,y:180},force:true});
  assert.equal(await keyboardUI.p.locator('.gn-results').count(),0);
 });await keyboardUI.c.close();
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
   assert.equal(await v.p.locator('.theme-category').count(),3);
   assert.ok(await v.p.locator('.theme-category').first().isVisible());
   assert.ok(await v.p.getByRole('combobox',{name:'Search products'}).isVisible());
   assert.ok(await v.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width<=700) assert.ok(await v.p.getByRole('navigation',{name:'Shopping navigation'}).isVisible());
  });await v.c.close();
 }
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
   await view.p.locator('.theme-category img').first().evaluate(image => image.decode());
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
   const cta=shop.p.locator('.theme-category').first();
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

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
 const mock=await mockStorefront(c,f.products,options);
 const p=await c.newPage();p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push({url:p.url(),message:e.message}));
 return {c,p,mock};
}
async function visit(p,route){await p.goto(f.url+route);await p.locator('main').waitFor();await p.waitForTimeout(350);}
async function waitForMovingVideo(p){
 await p.waitForFunction(()=>{
  const v=document.querySelector('.cinema-film');
  return v && !v.paused && v.currentTime>0.12 && v.videoWidth>0
    && Number(getComputedStyle(v).opacity)>.9;
 },undefined,{timeout:20000});
}
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
  await keyboardUI.p.locator('.cinema-hero').click({position:{x:10,y:180},force:true});
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
 const galleryChoice=await context(390,{browser:{isMobile:true,hasTouch:true}});
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
  await visit(buy.p,'/');await buy.p.getByRole('button',{name:'Open menu',exact:true}).click();await buy.p.getByRole('button',{name:'Close menu',exact:true}).waitFor();await buy.p.keyboard.press('Escape');
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
  await check(width+'px flagship cinematic hero and responsive navigation',async()=>{
   await visit(v.p,'/');
   await v.p.getByRole('heading',{name:/Built for your every move/i}).waitFor();
   assert.ok(await v.p.getByRole('link',{name:/Shop Now/}).isVisible());
   assert.ok(await v.p.getByRole('link',{name:/Explore Collections/}).isVisible());
   assert.equal(await v.p.getByRole('button',{name:/Pause hero film|Play hero film/}).count(),0);
   const m=await v.p.evaluate(()=>{
    const r=(s)=>{const x=document.querySelector(s).getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height};};
    return {page:document.documentElement.scrollWidth,vw:innerWidth,hero:r('.cinema-hero'),stage:r('.cinema-stage'),content:r('.cinema-content'),shop:r('.cinema-shop'),explore:r('.cinema-explore')};
   });
   assert.ok(m.page<=m.vw+1,JSON.stringify(m));
   assert.ok(m.shop.right<=width+1 && m.explore.right<=width+1,JSON.stringify(m));
   if(width<=700){
    assert.ok(m.stage.width>=width-1 && m.hero.width>=width-1,'Mobile footage must fill viewport without letterbox');
    assert.ok(m.hero.height>=450 && m.content.bottom<=m.hero.bottom+1,'Copy overlaid inside full-screen mobile hero');
    assert.ok(m.shop.bottom<=m.hero.bottom+1 && m.explore.bottom<=m.hero.bottom+1,'Mobile CTAs remain visible');
    assert.ok(await v.p.getByRole('button',{name:'Open menu'}).isVisible());
    assert.ok(await v.p.getByRole('combobox',{name:'Search products'}).isVisible());
   }else{
    assert.ok(m.stage.left>m.hero.left+m.hero.width*.35,'Desktop split retains film on the right');
    assert.ok(m.content.right<=m.stage.left+2,'Desktop content stays left of the film');
   }
  });await v.c.close();
 }
 for(const width of [390,1440]){
  const v=await context(width);const media=[];v.p.on('request',r=>{if(r.url().includes('/media/campaign/'))media.push(r.url());});
  await check(width+'px native autoplay is not disabled by application preference heuristics',async()=>{
   await visit(v.p,'/');
   assert.ok(await v.p.locator('.cinema-poster img').evaluate(i=>i.complete&&i.naturalWidth>0));
   assert.ok(media.some(u=>u.includes(width<700?'hero-mobile.webp':'hero-desktop.webp')));
   await waitForMovingVideo(v.p);
   const state=await v.p.locator('.cinema-film').evaluate(v=>({autoplay:v.autoplay,muted:v.muted,defaultMuted:v.defaultMuted,inline:v.playsInline,loop:v.loop,preload:v.preload,paused:v.paused}));
   assert.ok(state.autoplay&&state.muted&&state.defaultMuted&&state.inline&&state.loop&&!state.paused,JSON.stringify(state));
   assert.equal(state.preload,'auto');
   assert.equal(await v.p.locator('.cinema-play-fallback,.cinema-control').count(),0);
  });await v.c.close();
  const motion=await context(width,{browser:{reducedMotion:'no-preference'}});const requests=[];
  motion.p.on('request',r=>{if(r.url().endsWith('.mp4'))requests.push(r.url());});
  await check(width+'px hero loops continuously without remounting or pausing',async()=>{
   await visit(motion.p,'/');await waitForMovingVideo(motion.p);
   assert.ok(requests.length>0 && requests.every(u=>u.endsWith(width<700?'hero-mobile.mp4':'hero-desktop.mp4')));
   const state=await motion.p.locator('.cinema-film').evaluate(v=>({muted:v.muted,inline:v.playsInline,autoplay:v.autoplay,loop:v.loop,controls:v.controls}));
   assert.ok(state.muted&&state.inline&&state.autoplay&&state.loop&&!state.controls,JSON.stringify(state));
   await motion.p.evaluate(()=>{window.__initialHeroVideo=document.querySelector('.cinema-film');});
   await motion.p.setViewportSize({width:width===390?430:1366,height:960});
   assert.ok(await motion.p.evaluate(()=>window.__initialHeroVideo===document.querySelector('.cinema-film')),'Responsive resize must retain player');
   // Seek to the end twice to prove native playback wraps and keeps running.
   for(let cycle=0;cycle<2;cycle++){
    await motion.p.locator('.cinema-film').evaluate(v=>{v.currentTime=Math.max(0,v.duration-.18);});
    await motion.p.waitForFunction(()=>{const v=document.querySelector('.cinema-film');return v && Number.isFinite(v.duration) && v.duration>1 && v.currentTime<1 && !v.paused;},undefined,{timeout:20000});
   }
   await motion.p.evaluate(()=>scrollTo(0,1600));await motion.p.waitForTimeout(160);
   await motion.p.evaluate(()=>scrollTo(0,0));await motion.p.waitForTimeout(160);
   const final=await motion.p.locator('.cinema-film').evaluate(v=>({paused:v.paused,loop:v.loop,ready:Number(getComputedStyle(v).opacity)>.9}));
   assert.ok(!final.paused&&final.loop&&final.ready,JSON.stringify(final));
   assert.ok(await motion.p.evaluate(()=>window.__initialHeroVideo===document.querySelector('.cinema-film')));
   assert.ok(requests.every(u=>u.endsWith(width<700?'hero-mobile.mp4':'hero-desktop.mp4')));
   await motion.p.reload();await waitForMovingVideo(motion.p);
   await motion.p.getByRole('link',{name:/Shop Now/}).click();await motion.p.waitForURL('**/shop');
   await motion.p.goBack();await waitForMovingVideo(motion.p);
   assert.ok(await motion.p.locator('.cinema-film').evaluate(v=>!v.paused&&v.loop&&v.muted));
  });await motion.c.close();
 }
 const autoplay=await context(390,{browser:{reducedMotion:'no-preference'}});
 await autoplay.c.addInitScript(()=>{
  const nativePlay=HTMLMediaElement.prototype.play;
  window.allowFilmPlayback=false;
  HTMLMediaElement.prototype.play=function(){
   return window.allowFilmPlayback?nativePlay.call(this):Promise.reject(new DOMException('Blocked autoplay','NotAllowedError'));
  };
 });
 await check('Blocked mobile autoplay shows poster and shopping links without playback controls',async()=>{
  await visit(autoplay.p,'/');await autoplay.p.waitForTimeout(350);
  const video=autoplay.p.locator('.cinema-film');
  assert.equal(await video.count(),1);
  assert.ok(await autoplay.p.locator('.cinema-poster img').evaluate(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await video.evaluate(v=>v.loop&&v.muted&&v.playsInline&&!v.controls),true);
  // Chromium may start native HTML autoplay even if JS play() is mocked.
  // Force an actual media failure to verify the visible poster fallback.
  await video.evaluate(v=>{v.pause();v.dispatchEvent(new Event('error'));});
  await autoplay.p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.cinema-film')).opacity)===0);
  assert.equal(await autoplay.p.locator('.cinema-film.is-autoplay-blocked').count(),1);
  assert.equal(await autoplay.p.locator('.cinema-play-fallback,.cinema-control').count(),0);
  assert.equal(await autoplay.p.getByRole('button',{name:/Play cinematic|Pause hero|Replay/i}).count(),0);
  assert.ok(await autoplay.p.getByRole('link',{name:/Shop Now/}).isVisible());
  assert.ok(await autoplay.p.getByRole('link',{name:/Explore Collections/}).isVisible());
 });await autoplay.c.close();
 const diagnostics=await context(390,{browser:{reducedMotion:'no-preference',isMobile:true,hasTouch:true}});
 await check('Opt-in iPhone video diagnostics report advancing frames and never appear by default',async()=>{
  await visit(diagnostics.p,'/?heroDebug=1');await waitForMovingVideo(diagnostics.p);
  await diagnostics.p.waitForFunction(()=>window.__gymdrobeHeroVideoState?.()?.movingSinceLastSample===true);
  const info=await diagnostics.p.evaluate(()=>window.__gymdrobeHeroVideoState());
  assert.ok(!info.paused && info.videoWidth>0 && info.currentTime>0 && !info.mediaErrorCode,JSON.stringify(info));
  assert.equal(info.lastPlayError,null);
  assert.equal(await diagnostics.p.locator('aside[aria-label="Hero video diagnostics"]').count(),1);
  await visit(diagnostics.p,'/');
  assert.equal(await diagnostics.p.locator('aside[aria-label="Hero video diagnostics"]').count(),0);
 });await diagnostics.c.close();
 const iphone=await context(390,{browser:{reducedMotion:'no-preference',isMobile:true,hasTouch:true,deviceScaleFactor:3}});
 await check('iPhone-style mobile viewport has muted inline native autoplay and no fullscreen controls',async()=>{
  await visit(iphone.p,'/');
  const video=iphone.p.locator('.cinema-film');
  await waitForMovingVideo(iphone.p);
  assert.ok(await video.evaluate(v=>!v.paused&&v.autoplay&&v.muted&&v.loop&&v.playsInline&&!v.controls));
  assert.equal(await video.getAttribute('preload'),'auto');
  assert.ok(await video.evaluate(v=>v.hasAttribute('playsinline')&&v.hasAttribute('webkit-playsinline')));
  assert.equal(await iphone.p.locator('.cinema-play-fallback,.cinema-control').count(),0);
  assert.equal(await iphone.p.getByRole('button',{name:/Play cinematic|Pause hero|Replay/i}).count(),0);
 });await iphone.c.close();
 const fail=await context(390,{browser:{reducedMotion:'no-preference'}});await fail.c.route('**/media/campaign/*.mp4',r=>r.abort());
 await check('Failed film retains poster and Shop Now',async()=>{
  await visit(fail.p,'/');await fail.p.waitForTimeout(350);
  assert.ok(await fail.p.locator('.cinema-poster img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await fail.p.getByRole('link',{name:/Shop Now/}).click();await fail.p.waitForURL('**/shop');
 });await fail.c.close();
 const save=await context(390,{browser:{reducedMotion:'no-preference'}});
 await save.c.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true},configurable:true}));
 await check('Mobile data-saving hint does not disable autoplay where browser permits it',async()=>{
  await visit(save.p,'/');
  await waitForMovingVideo(save.p);
  const video=save.p.locator('.cinema-film');
  assert.equal(await video.count(),1);
  assert.equal(await video.getAttribute('preload'),'auto');
  assert.ok(await video.evaluate(v=>v.autoplay&&v.loop&&v.muted&&!v.paused));
  assert.equal(await save.p.locator('.cinema-play-fallback,.cinema-control').count(),0);
  assert.ok(await save.p.getByRole('link',{name:/Shop Now/}).isVisible());
 });await save.c.close();
 await check('Premium controls use Lucide SVG arrows and preserve shopping action semantics',async()=>{
  const shop=await context(390,{signedIn:true});
  try{
   await visit(shop.p,'/');
   for(const name of [/Shop Now/,/Explore Collections/,/Shop all/]){
    const link=shop.p.getByRole('link',{name}).first();
    assert.ok(await link.isVisible(),String(name)+' link visible');
    assert.ok(await link.locator('svg.premium-control-arrow').count()>0,String(name)+' has Lucide vector');
   }
   const cta=shop.p.locator('.cinema-shop');
   assert.ok(await cta.evaluate(el=>el.getBoundingClientRect().height>=44));
   assert.equal(await shop.p.locator('.cinema-hero').innerText().then(t=>/[↗→⬆➡]/.test(t)),false);
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

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
let chromium;
try { ({chromium}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || 'playwright')); }
catch { console.error('Install browser test tools first: npm install --no-save --package-lock=false playwright\nThen: npx playwright install chromium');process.exit(1); }
const server=await createServer({root,server:{host:'127.0.0.1',port:4196,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.GYMDROBE_CHROMIUM_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[],passed=[];
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:4196';
const go=async(route,p=page)=>{await p.goto(url+route);await p.locator('main').waitFor();await p.locator('.page-loading').waitFor({state:'hidden'});await p.waitForLoadState('networkidle');};
const until=async(fn)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Condition did not become true');};
const checked=async(locator,value=true)=>{if(await locator.isChecked()!==value)await locator.click();await until(async()=>await locator.isChecked()===value);};
const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
const keyValue=async(base,p=page)=>p.evaluate(base=>{const user=JSON.parse(localStorage.getItem('gymdrobe-user')||'null');return JSON.parse(localStorage.getItem(user?base+':'+String(user.id).toLowerCase():base)||'null')},base);
const signup=async(email,name='Test Customer')=>{await go('/signup');await page.getByLabel('Full name',{exact:true}).fill(name);await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('TestPass123');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL('**/account');};
const logout=async()=>{await go('/account');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(u=>u.pathname==='/login');};
const login=async(email,password='TestPass123')=>{await go('/login');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/account');};
const fillAddress=async()=>{for(const [label,value] of [['Full name','Test Customer'],['Email','alice@example.com'],['Mobile number','9876543210'],['House number, building and street','42 Training Street'],['City','Kozhikode'],['State','Kerala'],['Pincode','673001']])await page.getByLabel(label,{exact:true}).fill(value);};
let placed;
try {
 await check('homepage carousel and search aliases',async()=>{
  await go('/');assert.equal(await page.locator('canvas,video').count(),0);
  const before=await page.locator('h1').innerText();await page.getByRole('button',{name:'Next collection',exact:true}).click();assert.notEqual(await page.locator('h1').innerText(),before);
  const search=page.getByRole('combobox',{name:'Search products'});await search.fill('tee');await search.press('Enter');await page.waitForURL('**search=tee');await page.locator('.shop-results .gm-product-card').first().waitFor();assert.equal(await page.locator('.shop-results .gm-product-card').count(),1);
 });
 await check('multiple categories, individual filter chips, sorting and quick view',async()=>{
  await go('/shop');const filters=page.locator('.desktop-filters');await checked(filters.getByLabel('Workout Clothes',{exact:false}));await checked(filters.getByLabel('Gym Shoes',{exact:false}));assert.equal(await page.locator('.shop-results .gm-product-card').count(),2);
  await page.getByRole('combobox',{name:'Sort by:'}).selectOption('price-high');await until(async()=>(await page.locator('.shop-results .gm-product-copy h3').first().innerText()).includes('Shoes'));
  await page.getByRole('button',{name:'Remove category filter: Gym Shoes',exact:true}).click();await until(async()=>await page.locator('.shop-results .gm-product-card').count()===1);
  await page.locator('.shop-results').getByRole('button',{name:'QUICK VIEW',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'M',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Add to bag',exact:true}).click();await page.getByRole('dialog').getByRole('link',{name:'View bag & checkout →'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
 });
 await check('bag and wishlist synchronize between two open tabs',async()=>{
  const other=await context.newPage();await go('/cart',other);
  await go('/product/2');await page.getByRole('button',{name:'Add to bag',exact:true}).click();await other.locator('.bag-item').nth(1).waitFor();assert.equal(await other.locator('.bag-item').count(),2);
  await other.getByRole('button',{name:'Increase quantity of Gym Training T-Shirt',exact:true}).click();await go('/cart');assert.equal((await keyValue('gymdrobe-cart')).find(item=>item.id===1).quantity,2);
  await go('/product/1');await page.locator('.product-options').getByRole('button',{name:'Wishlist',exact:true}).click();await go('/wishlist',other);assert.equal(await other.locator('.gm-product-card').count(),1);await other.close();
 });
 await check('guest bag transfers on sign-in; separate accounts keep separate bags',async()=>{
  await signup('alice@example.com','Alice Customer');assert.equal((await keyValue('gymdrobe-cart')).length,2);assert.equal(await page.evaluate(()=>localStorage.getItem('gymdrobe-cart')),null);
  await logout();await go('/cart');await page.getByRole('heading',{name:'Your bag is empty',exact:true}).waitFor();
  await signup('bob@example.com','Bob Customer');await go('/cart');await page.getByRole('heading',{name:'Your bag is empty',exact:true}).waitFor();await go('/wishlist');assert.equal(await page.locator('.gm-product-card').count(),0);
  await logout();await login('alice@example.com');await go('/cart');assert.equal(await page.locator('.bag-item').count(),2);
 });
 await check('coupon validation, selected checkout, address errors and exact totals',async()=>{
  await page.getByRole('checkbox',{name:/Select Performance Gym Shoes/}).uncheck();
  await page.getByLabel('Coupon code',{exact:true}).fill('NOTREAL');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByText('Enter a valid coupon code.',{exact:true}).waitFor();
  await page.getByLabel('Coupon code',{exact:true}).fill('MIDLAJ');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByText('Coupon applied',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Continue to address',exact:true}).click();await page.waitForURL('**mode=selection');
  await page.getByRole('button',{name:'Continue to review',exact:true}).click();assert.ok(await page.locator('[aria-invalid="true"]').count());await fillAddress();await page.getByLabel('Gift message (optional, no extra charge)',{exact:true}).fill('Enjoy your next session');
  await page.getByRole('button',{name:'Continue to review',exact:true}).click();await page.getByRole('button',{name:'Place preview order',exact:true}).click();await page.waitForURL('**order-success?orderId=*');
  placed=await page.evaluate(()=>JSON.parse(localStorage.getItem('gymdrobe-orders'))[0]);assert.equal(placed.pricing.finalTotal,1294.2);assert.equal(placed.items.length,1);assert.equal(placed.items[0].quantity,2);assert.equal(placed.giftMessage,'Enjoy your next session');assert.equal((await keyValue('gymdrobe-cart'))[0].id,2);
 });
 await check('receipts, order ownership, cancellation and inventory restoration',async()=>{
  await go(`/orders/${placed.id}/receipt`);await page.getByRole('heading',{name:'Order receipt',exact:true}).waitFor();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();assert.match((await download).suggestedFilename(),/receipt.csv$/);
  await logout();await login('bob@example.com');await go(`/orders/${placed.id}`);await page.getByRole('heading',{name:'Order not found',exact:true}).waitFor();
  await logout();await login('alice@example.com');await go(`/orders/${placed.id}`);await page.getByRole('button',{name:'Cancel order',exact:true}).click();await page.getByLabel('Reason',{exact:true}).fill('Testing cancellation');await page.getByRole('button',{name:'Confirm cancellation',exact:true}).click();await page.getByText('Cancellation reason: Testing cancellation',{exact:true}).waitFor();
  await go(`/orders/${placed.id}/track`);await page.getByText('This order has been cancelled.',{exact:true}).waitFor();
 });
 await check('save for later, restore variant, compare, and saved address editing',async()=>{
  await go('/cart');await page.getByRole('button',{name:'Save for later',exact:true}).click();await go('/saved');await page.getByRole('button',{name:'Move to bag',exact:true}).click();assert.equal((await keyValue('gymdrobe-saved-for-later')).length,0);assert.equal((await keyValue('gymdrobe-cart'))[0].id,2);
  await go('/product/1');await page.getByRole('button',{name:'Compare this product',exact:true}).click();await go('/product/2');await page.getByRole('button',{name:'Compare this product',exact:true}).click();await go('/compare');assert.equal(await page.locator('.comparison-table thead th').count(),3);
  await go('/addresses');assert.equal(await page.locator('.address-card').count(),1);await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('dialog').getByLabel('City',{exact:true}).fill('Calicut');await page.getByRole('button',{name:'Save address',exact:true}).click();await page.locator('.address-card').getByText('Calicut',{exact:false}).waitFor();
 });
 await check('Buy now recovers from a catalogue price change',async()=>{
  await go('/product/1');await page.getByRole('button',{name:'Buy now',exact:true}).click();await page.getByRole('button',{name:'Continue to review',exact:true}).click();
  const editor=await context.newPage();await go('/dev/store',editor);await editor.getByRole('button',{name:'products',exact:true}).click();await editor.getByRole('button',{name:'Edit Gym Training T-Shirt',exact:true}).click();await editor.getByLabel('Original price ₹',{exact:true}).fill('899');await editor.getByRole('button',{name:'Save product',exact:true}).click();
  await page.getByText('₹809.00',{exact:true}).first().waitFor();await page.getByRole('button',{name:'Place preview order',exact:true}).click();await page.getByRole('alert').filter({hasText:'Your selection or total has changed'}).waitFor();
  await page.getByRole('button',{name:'Place preview order',exact:true}).click();await page.waitForURL('**order-success?orderId=*');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('gymdrobe-orders'))[0])).pricing.subtotal,809);
  await editor.close();
 });
 await check('account password changes and login with the new password',async()=>{
  await go('/account/security');await page.getByLabel('Current password',{exact:true}).fill('TestPass123');await page.getByLabel('New password',{exact:true}).fill('NewPass456');await page.getByLabel('Confirm new password',{exact:true}).fill('NewPass456');await page.getByRole('button',{name:'Change password',exact:true}).click();await page.getByText('Preview account password updated.',{exact:true}).waitFor();await logout();await login('alice@example.com','NewPass456');
 });
 await check('reviews persist and update rating without reload',async()=>{
  await go('/product/1');await page.getByLabel('Your review',{exact:true}).fill('Comfortable for my training sessions.');await page.getByRole('button',{name:'Submit review',exact:true}).click();await page.locator('.review').getByText('Comfortable for my training sessions.',{exact:true}).waitFor();await page.reload();await page.locator('.review').getByText('Comfortable for my training sessions.',{exact:true}).waitFor();
 });
 await check('mobile menu and filters work with touch and keyboard',async()=>{
  await page.setViewportSize({width:390,height:844});await go('/');await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  await go('/shop');await page.getByRole('button',{name:'Filters',exact:true}).click();await checked(page.getByRole('dialog').getByLabel('In stock only',{exact:true}));await page.getByRole('button',{name:'Show 5 products',exact:true}).click();assert.equal(await page.locator('.shop-results .gm-product-card').count(),5);
 });
 await check('responsive layouts and missing-route recovery',async()=>{
  for(const width of [320,390,768,1440]) { await page.setViewportSize({width,height:900});for(const route of ['/','/shop','/product/1','/cart','/checkout?mode=cart','/wishlist','/account','/orders','/compare','/help','/offers']) {await go(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflows at ${width}`);} }
  await go('/does-not-exist');await page.getByRole('link',{name:'Back to home',exact:true}).click();await page.waitForURL(url+'/');
 });
 await page.setViewportSize({width:1440,height:960});await go('/');await page.screenshot({path:path.join(out,'home-desktop.png')});await go('/shop');await page.screenshot({path:path.join(out,'shop-desktop.png')});
 await page.setViewportSize({width:390,height:844});await go('/');await page.screenshot({path:path.join(out,'home-mobile.png')});await go('/product/1');await page.screenshot({path:path.join(out,'product-mobile.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({passed,errors},null,2));console.log(`Completed ${passed.length} browser scenarios without JavaScript errors.`);
} catch(error) { await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}); console.error('FAILED at '+page.url(),errors);throw error; }
finally { await browser.close();await server.close(); }
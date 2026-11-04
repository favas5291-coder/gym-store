import assert from 'node:assert/strict';
import {startStorefrontFixture,mockStorefront} from './storefront-fixture.mjs';
const {chromium,webkit}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE||'playwright');
process.env.VITE_API_URL='http://127.0.0.1:4239/api';
const f=await startStorefrontFixture(4239);
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});await mockStorefront(context,f.products);
  let mode='ok',calls=0;
  await context.route('**/api/auth/me',r=>{calls++;return r.fulfill({status:mode==='ok'?200:mode==='expired'?401:503,json:mode==='ok'?{success:true,user:{id:'507f1f77bcf86cd799439011',name:'Preview Customer',email:'preview@example.test',role:'customer'}}:{success:false,message:mode==='expired'?'Session expired':'Temporary outage'}});});
  const page=await context.newPage();await page.goto(f.url+'/account');await page.getByText('Your favourites. All together.',{exact:true}).waitFor();
  // Simulate sign-in in another same-origin tab. No Google/real account involved.
  const other=await context.newPage();await other.goto(f.url+'/');
  await other.evaluate(()=>localStorage.setItem('gymdrobe-auth-token','fixture-session'));
  await page.bringToFront();await page.getByRole('button',{name:/sign out|log out/i}).waitFor();
  await page.reload();await page.getByRole('button',{name:/sign out|log out/i}).waitFor();assert.ok(calls>=2);
  mode='outage';await page.reload();await page.getByRole('heading',{name:'Unable to verify your account',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('gymdrobe-auth-token')),'fixture-session');
  mode='ok';await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.getByRole('button',{name:/sign out|log out/i}).waitFor();
  const before=calls;await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.getByRole('button',{name:/sign out|log out/i}).waitFor();assert.ok(calls>before);
  // Cross-tab logout must clear the visible verified account, not reselect Google.
  await other.evaluate(()=>localStorage.removeItem('gymdrobe-auth-token'));await page.bringToFront();await page.getByText('Your favourites. All together.',{exact:true}).waitFor();
  mode='expired';await other.evaluate(()=>localStorage.setItem('gymdrobe-auth-token','expired-fixture'));await page.bringToFront();
  await page.waitForFunction(()=>localStorage.getItem('gymdrobe-auth-token')===null);assert.equal(await page.getByRole('button',{name:/sign out|log out/i}).count(),0);
  console.log(engine.name()+' mobile saved-session recovery passed');
 }finally{await browser.close();}
}}finally{await f.server.close();}

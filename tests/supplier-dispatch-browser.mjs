import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockStorefront, startStorefrontFixture } from './storefront-fixture.mjs';

const port=4261;
process.env.VITE_API_URL='http://127.0.0.1:'+port+'/api';
process.env.VITE_MARKETPLACE_ENABLED='true';
process.env.VITE_SUPPLIER_DISPATCH_REVIEW_ENABLED='true';
const fixture=await startStorefrontFixture(port);
let browser;
try {
  browser=await chromium.launch({...(process.env.GYMDROBE_CHROMIUM_PATH?{executablePath:process.env.GYMDROBE_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const {user}=await mockStorefront(context,fixture.products,{signedIn:true});
  let role='customer', nextAllowed=false;
  await context.route('**/api/auth/me',r=>r.fulfill({json:{success:true,user:{...user,role}}}));
  await context.route('**/api/marketplace/me',r=>r.fulfill({json:{success:true,account:{status:'active',email:'supplier@example.test',business:{legalName:'Fixture Supplier'}}}}));
  await context.route('**/api/marketplace/orders',r=>r.fulfill({json:{success:true,orders:[]}}));
  let queries=[];
  await context.route('**/api/marketplace/dispatch-review?**',r=>{
    const q=new URL(r.request().url()).searchParams;
    assert.equal(r.request().method(),'GET');
    assert.equal(q.get('source'),'real');
    assert.equal(q.has('supplier'),false);
    queries.push(q.get('after'));
    const first=!q.has('after');
    if(!nextAllowed)return r.fulfill({status:503,json:{success:false,message:'Fixture index unavailable.'}});
    return r.fulfill({json:{success:true,nextCursor:first?'000000000000000000000123':null,
      rows:first?[{fulfilmentId:'g1',orderId:'000000000000000000000001',timing:'overdue',dueAt:'2024-04-01T12:00:00Z',unknownItems:0}]:
      [{fulfilmentId:'g2',orderId:'000000000000000000000002',timing:'unknown',dueAt:null,unknownItems:1}]}});
  });
  const clock='elapsed-days-from-payment-verification';
  const terms={text:'Synthetic supplier terms for this isolated fixture.',dispatchDaysMin:1,dispatchDaysMax:2,settlementHoldHours:24,
    shippingResponsibility:'Supplier',returnsResponsibility:'Supplier',gatewayFeeResponsibility:'Platform',dispatchClock:clock};
  await context.route('**/api/marketplace/invitations/inspect',r=>r.fulfill({json:{success:true,businessName:'Fixture partner',terms,termsDigest:'fixture'}}));
  const page=await context.newPage();
  await page.goto(fixture.url+'/supplier/orders');
  const panel=page.getByRole('region',{name:'Dispatch timing'});
  await panel.waitFor();
  assert.equal(queries.length,0);
  await panel.getByRole('button',{name:'Review dispatch timing'}).click();
  await panel.getByText('Fixture index unavailable.').waitFor();
  nextAllowed=true;
  await panel.getByRole('button',{name:'Retry'}).click();
  await panel.getByText('Overdue',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Next page'}).click();
  await panel.getByText('Timing unknown',{exact:true}).waitFor();
  assert.equal(queries.at(-1),'000000000000000000000123');
  await panel.getByText('Missing timing for 1 purchased line').waitFor();
  assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await panel.getByRole('button',{name:'Previous page'}).click();
  await panel.getByText('Overdue',{exact:true}).waitFor();
  await page.goto(fixture.url+'/supplier/activate');
  await page.getByLabel('Private invitation code').fill('a'.repeat(64));
  await page.getByRole('button',{name:'Review invitation'}).click();
  await page.getByText(/Each day is 24 elapsed hours, including weekends and holidays/).waitFor();
  role='admin';
  await page.goto(fixture.url+'/admin/marketplace/new');
  const select=page.getByLabel('Agreed dispatch clock');
  await select.waitFor();
  assert.equal(await select.inputValue(),'');
  await select.selectOption(clock);
  assert.equal(await select.inputValue(),clock);
  await select.selectOption('');
  assert.equal(await select.inputValue(),'');
  console.log('PASS on-demand supplier dispatch view, mobile width, unknown/overdue pages and retry, explicit opt-in and pre-acceptance disclosure');
} finally {
  await browser?.close();
  await fixture.server.close();
}

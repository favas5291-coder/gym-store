import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { startStorefrontFixture, mockStorefront, fixtureProductId } from "./storefront-fixture.mjs";

const {chromium, webkit} = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
process.env.VITE_API_URL = "http://127.0.0.1:4282/api";
process.env.VITE_MARKETPLACE_ENABLED = "true";
const fixture = await startStorefrontFixture(4282);

async function guestDelivery(browser) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  try {
    await mockStorefront(context,fixture.products);
    const page = await context.newPage();
    await page.goto(fixture.url+"/product/"+fixtureProductId);
    await page.getByRole("button",{name:"Colour Black",exact:true}).first().click();
    await page.getByRole("button",{name:"Size M",exact:true}).first().click();
    await page.getByRole("button",{name:/Add to (Cart|Bag)/i}).first().click();
    await page.getByText("✓ Added to your bag").waitFor();
    await page.goto(fixture.url+"/checkout");
    const field = page.locator('input[name="addressLine"]');
    const street = "42 Private fixture street";
    await field.fill(street);
    await page.getByText("Draft saved on this device.",{exact:true}).waitFor();
    assert.equal(await page.evaluate(street => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value=>value.includes(street)),street),false);
    await page.reload();
    await page.waitForFunction(street=>document.querySelector('input[name="addressLine"]')?.value===street,street);
    await page.getByRole("button",{name:"Clear saved delivery details"}).click();
    await page.getByText("Saved delivery details cleared.",{exact:true}).waitFor();
    await page.reload();
    await field.waitFor();
    assert.equal(await field.inputValue(),"");
  } finally { await context.close(); }
}

async function customerForms(browser) {
  const cases = [
    {route:"/help", field:"#help-message", text:"Which size can I exchange this for?"},
    {route:"/account", field:"#profile-name", text:"Customer fixture name"},
    {route:"/addresses", field:'input[name="addressLine"]', text:"42 Customer fixture street"},
  ];
  for (const {route,field,text} of cases) {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    try {
      await mockStorefront(context,fixture.products,{signedIn:true});
      await context.route("**/api/auth/draft-key",r=>r.fulfill({json:{success:true,key:Buffer.alloc(32,4).toString("base64")}}));
      const page = await context.newPage();
      await page.goto(fixture.url+route);
      if (route==="/account") await page.locator("#profile-details summary").click();
      if (route==="/addresses") await page.getByRole("button",{name:"+ Add new address"}).click();
      await page.locator(field).fill(text);
      await page.getByText("Draft saved on this device.",{exact:true}).waitFor();
      await page.reload();
      if (route==="/account") await page.locator("#profile-details summary").click();
      await page.getByRole("button",{name:"Resume draft"}).click();
      assert.equal(await page.locator(field).inputValue(),text);
      console.log("PASS",browser.browserType().name(),route,"recovers the customer's own field");
    } finally { await context.close(); }
  }
}

async function supplierPhotos(browser) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const account="507f1f77bcf86cd799439011";
  try {
    await mockStorefront(context,fixture.products);
    await context.addInitScript(()=>localStorage.setItem("gymdrobe-auth-token","fixture-session"));
    await context.route("**/api/auth/me",r=>r.fulfill({json:{success:true,user:{id:account,role:"supplier",name:"Fixture supplier"}}}));
    await context.route("**/api/auth/draft-key",r=>r.fulfill({json:{success:true,key:Buffer.alloc(32,3).toString("base64")}}));
    await context.route("**/api/marketplace/me",r=>r.fulfill({json:{success:true,account:{id:account,status:"active",business:{displayName:"Fixture",brands:["Fixture"],categories:["Clothing"]}}}}));
    const id="507f1f77bcf86cd799439fff";
    let finishUpload;
    const release=new Promise(resolve=>{finishUpload=resolve;});
    const uploads=[];
    await context.route("**/api/marketplace/media",async r=>{
      uploads.push(r.request().postDataJSON().base64);
      if (uploads.length === 1) {
        await release;
        await r.abort().catch(()=>{});
        return;
      }
      await r.fulfill({json:{success:true,media:{id,url:"/api/marketplace/media/"+id,preview:"/brand/app-icon-192.webp"}}});
    });
    const page=await context.newPage();
    await page.goto(fixture.url+"/supplier/new");
    const name=page.getByLabel("Product name",{exact:true});
    await name.fill("Fixture supplier shirt");
    const sending=page.waitForRequest(req=>new URL(req.url()).pathname==="/api/marketplace/media");
    await page.locator('input[type="file"]').first().setInputFiles(fileURLToPath(new URL("../public/brand/gymdrobe-wordmark-cream.png",import.meta.url)));
    await sending;
    const other=await context.newPage();
    await other.goto("about:blank"); await other.bringToFront();
    // Destroy the WebView while the first HTTP response is outstanding.
    await page.close(); finishUpload(); await other.bringToFront();
    await other.goto(fixture.url+"/supplier/new");
    await other.getByRole("button",{name:"Resume draft"}).click();
    await other.getByRole("button",{name:"Continue photo uploads"}).click();
    const photo=other.getByAltText("Product photo 1",{exact:true});
    await photo.waitFor();
    assert.equal(await photo.getAttribute("src"),"/brand/app-icon-192.webp");
    assert.deepEqual(uploads,[uploads[0],uploads[0]]);
    assert.ok(uploads[0].length>1000);
    await other.getByText("Draft saved on this device.",{exact:true}).waitFor();
    await other.reload(); await other.getByRole("button",{name:"Resume draft"}).click();
    assert.equal(await other.getByLabel("Product name",{exact:true}).inputValue(),"Fixture supplier shirt");
    assert.equal(await photo.getAttribute("src"),"/brand/app-icon-192.webp");
  } finally { await context.close(); }
}

try {
  for (const engine of [chromium,webkit]) {
    const browser=await engine.launch({headless:true});
    try {
      await guestDelivery(browser);
      console.log("PASS",engine.name(),"guest address encrypted, restored and discarded");
      await customerForms(browser);
      await supplierPhotos(browser);
      console.log("PASS",engine.name(),"interrupted supplier upload recovered identical photo bytes and a single gallery image");
    } finally { await browser.close(); }
  }
} finally { await fixture.server.close(); }

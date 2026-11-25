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
    await context.route("**/api/marketplace/media",async r=>{
      await release;
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
    finishUpload(); await page.bringToFront();
    const photo=page.getByAltText("Product photo 1",{exact:true});
    await photo.waitFor();
    assert.equal(await photo.getAttribute("src"),"/brand/app-icon-192.webp");
    await page.getByText("Draft saved on this device.",{exact:true}).waitFor();
    await page.reload(); await page.getByRole("button",{name:"Resume draft"}).click();
    assert.equal(await name.inputValue(),"Fixture supplier shirt");
    assert.equal(await photo.getAttribute("src"),"/brand/app-icon-192.webp");
  } finally { await context.close(); }
}

try {
  for (const engine of [chromium,webkit]) {
    const browser=await engine.launch({headless:true});
    try {
      await guestDelivery(browser);
      console.log("PASS",engine.name(),"guest address encrypted, restored and discarded");
      await supplierPhotos(browser);
      console.log("PASS",engine.name(),"supplier photo upload, background switch and recovery");
    } finally { await browser.close(); }
  }
} finally { await fixture.server.close(); }

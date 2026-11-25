import assert from "node:assert/strict";
import { startStorefrontFixture, mockStorefront } from "./storefront-fixture.mjs";
const { chromium, webkit } = await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || "playwright");
process.env.VITE_API_URL = "http://127.0.0.1:4259/api";
const fixture = await startStorefrontFixture(4259);
try {
  for (const engine of [chromium, webkit]) {
    const path = engine === chromium ? process.env.GYMDROBE_CHROMIUM_PATH : process.env.GYMDROBE_WEBKIT_PATH;
    const browser = await engine.launch({ headless: true, ...(path ? {executablePath:path} : {}) });
    try {
      const context = await browser.newContext({viewport:{width:390,height:844}});
      await mockStorefront(context, fixture.products);
      let owner = "507f1f77bcf86cd799439011";
      let status = 200;
      let reads = 0;
      await context.route("**/api/auth/me", async route => {
        reads++;
        await new Promise(done => setTimeout(done, 120));
        await route.fulfill({status, json: status === 200 ? {success:true,user:{id:owner,role:"admin",name:"Fixture administrator"}} : {success:false,message:"Session check unavailable"}});
      });
      await context.route("**/api/auth/draft-key", route => route.fulfill({json:{success:true,key:Buffer.alloc(32,owner.endsWith("1")?1:2).toString("base64")}}));
      await context.route("**/api/products/admin**", route => route.fulfill({json:{success:true,products:[],total:0,pages:1,categories:["Clothing"],brands:[],subcategories:{},suppliers:[]}}));
      const page = await context.newPage();
      await page.goto(fixture.url+"/login");
      await page.evaluate(()=>localStorage.setItem("gymdrobe-auth-token","test-session"));
      await page.goto(fixture.url+"/admin/products");
      await page.getByRole("button",{name:"+ Add product"}).click();
      const name = page.getByLabel("Product name").first();
      await name.fill("Recovery fixture tee");
      await page.getByText("Draft saved on this device.",{exact:true}).waitFor();
      const check = async(type, responseStatus) => {
        status=responseStatus;
        const response=page.waitForResponse(r=>r.url().endsWith("/api/auth/me"));
        const before=reads;
        await page.evaluate(type=>{window.dispatchEvent(new Event(type));document.dispatchEvent(new Event("visibilitychange"));},type);
        await response;
        await page.waitForTimeout(160);
        assert.equal(reads,before+1);
        assert.equal(await name.inputValue(),"Recovery fixture tee");
      };
      await check("focus",200);
      await check("online",503);
      status=200;
      await page.reload();
      await page.getByRole("button",{name:"Resume draft"}).click();
      assert.equal(await name.inputValue(),"Recovery fixture tee");
      await page.getByText("Draft saved on this device.",{exact:true}).waitFor();
      const record=await page.evaluate(async()=>{
        const db=await new Promise((resolve,reject)=>{const q=indexedDB.open("gymdrobe-editor-drafts");q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
        return new Promise(resolve=>{const q=db.transaction("entries").objectStore("entries").getAll();q.onsuccess=()=>resolve(q.result.map(r=>({fields:Object.keys(r).sort(),bytes:r.bytes.byteLength,text:new TextDecoder().decode(r.bytes)})));});
      });
      assert.equal(record.length,1);
      assert.deepEqual(record[0].fields,["bytes","iv","revision"]);
      assert.ok(record[0].bytes>32 && !record[0].text.includes("Recovery fixture tee"));

      const other=await context.newPage();
      await other.goto(fixture.url+"/admin/products?editor=new");
      await other.getByRole("button",{name:"Resume draft"}).click();
      await other.getByText("Draft saved on this device.",{exact:true}).waitFor();
      await name.fill("Older tab");
      await page.getByText(/Another window changed this draft/).waitFor();
      await other.close();
      await page.reload();
      await page.getByRole("button",{name:"Resume draft"}).click();
      assert.equal(await name.inputValue(),"Recovery fixture tee");
      status=401; await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(()=>localStorage.getItem("gymdrobe-auth-token")===null);
      assert.equal(await name.count(),0);
      owner="507f1f77bcf86cd799439012";status=200;
      await page.evaluate(()=>localStorage.setItem("gymdrobe-auth-token","second-account"));
      await page.goto(fixture.url+"/admin/products");
      await page.getByRole("button",{name:"+ Add product"}).click();
      await page.waitForTimeout(300);
      assert.equal(await name.inputValue(),"");
      assert.equal(await page.getByRole("button",{name:"Resume draft"}).count(),0);
      console.log("PASS",engine.name(),"foreground, outage, reload, ciphertext, concurrent tabs, expiration and account isolation");
    } finally { await browser.close(); }
  }
} finally { await fixture.server.close(); }

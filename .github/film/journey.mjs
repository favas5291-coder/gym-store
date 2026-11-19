import { chromium, webkit, devices } from "playwright";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
const phase = process.env.PHASE || "before";
let site = (process.env.TARGET || "https://www.gymdrobe.com").replace(/\/$/, "");
const dir = process.env.OUT || "film";
await fs.mkdir(dir,{recursive:true});
const browser = await webkit.launch({headless:true});
const context = await browser.newContext({...devices["iPhone 13"], viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir,size:{width:390,height:844}}});
let server;
if (process.env.BUILD_DIR) {
  const http = await import('node:http');
  const root = process.env.BUILD_DIR;
  const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
  server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const path=pathname.match(/\.[a-z0-9]+$/i)?pathname:'/index.html';
    try{const body=await fs.readFile(root+path);res.writeHead(200,{'content-type':mime[path.match(/\.\w+$/)?.[0]]||'application/octet-stream','content-length':body.length});res.end(body);}
    catch{console.log('static-miss '+path);res.writeHead(404).end();}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));site='http://127.0.0.1:'+server.address().port;
  await context.route('https://gym-drobe-backend.onrender.com/**',async route=>{
    try{const response=await route.fetch({headers:{...route.request().headers(),Origin:'https://www.gymdrobe.com'}});return route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':site,'access-control-allow-credentials':'true'}})}catch{return route.abort()}
  });
}
await context.addInitScript(() => {
  window.film = {start: performance.timeOrigin};
  const isFront = node => {
    if(!node) return false;
    const r=node.getBoundingClientRect();
    if(!r.width||!r.height) return false;
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return hit && (node.contains(hit) || hit.contains(node));
  };
  function frame(t){
    const f=window.film;
    const overlay = document.querySelector('#gymdrobe-opening');
    const logo = overlay?.querySelector('img');
    if(f.logo==null && logo && logo.complete && logo.naturalWidth && getComputedStyle(overlay).display!=='none' && isFront(overlay))f.logo=t;
    const campaign = document.querySelector('#app .department-tile');
    const img = campaign?.querySelector('img');
    if(f.photo==null && img?.complete && img.naturalWidth){img.decode().then(()=>{f.photo??=performance.now()}).catch(()=>{})}
    if(f.ready==null && campaign && isFront(campaign)){f.ready=t;f.readyHref=campaign.href}
    if(f.logo!=null && f.gone==null && overlay && (getComputedStyle(overlay).display==='none'||!overlay.getBoundingClientRect().width))f.gone=t;
    if(!overlay && f.logo!=null && f.gone==null)f.gone=t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('click', e=>{const a=e.target.closest?.('a');if(a&&a.href.includes('gender=Women')) {window.film.tap=performance.now();window.film.tapHref=a.href}},true)
});
const page = await context.newPage();
const vid=page.video();
page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text().slice(0,500))});
page.on('requestfailed',r=>console.log('FAILED',r.resourceType(),r.url().split('?')[0],r.failure()?.errorText));
page.on('response',r=>{if(r.status()>=400)console.log('HTTP_FAILURE',r.status(),r.url().split('?')[0])});
const requests=[];const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("request",r=>requests.push({url:r.url(),type:r.resourceType(),r}));
await page.waitForTimeout(250);const nav=Date.now();
const response = await page.goto(site+'/',{waitUntil:'commit',timeout:90000});
await page.waitForFunction(()=>Boolean(window.film?.ready && (window.film.gone || window.film.logo == null)),{},{timeout:30000});
const tile=page.locator('#app .department-tile').first();
const frame=await tile.boundingBox();
// Give the recording one deliberate human-length look at the campaign while recording the first hit-test separately.
await page.waitForTimeout(phase==="production" ? 800 : 420);
let measurement=await page.evaluate(()=>({...window.film,current:performance.now()}));
let catalogue = requests.filter(v=>new URL(v.url).pathname==='/api/products');
const gettingPreloadImages=Promise.all(requests.filter(v=>v.type==='image').map(async v=>{try{let r=await Promise.race([v.r.response(),new Promise(ok=>setTimeout(()=>ok(null),500))]);let size=await Promise.race([r?.body(),new Promise(ok=>setTimeout(()=>ok(null),500))]);return {url:v.url,bytes:size?.length||null}}catch{return {url:v.url,bytes:null}}}));
const original=await page.evaluate(()=>performance.timeOrigin);
await page.touchscreen.tap(frame.x+frame.width/2,frame.y+frame.height/2);
await page.waitForURL(/gender=Women/,{timeout:25000});
await page.locator('h1').first().waitFor({timeout:15000});
const outcome=await page.evaluate(()=>({url:location.href,heading:document.querySelector('h1')?.textContent,clock:performance.timeOrigin,...window.film}));
measurement={...measurement,tapMs:outcome.clock===original?outcome.tap:null};
const collection=page.locator('a[href^="/product/"]').first();
await collection.waitFor({timeout:35000}).catch(async e=>{console.log('PAGE_END', (await page.locator('body').innerText()).slice(0,1500));await page.screenshot({path:dir+'/failure.png'});throw e;});
const actualCollection={heading:await page.locator('h1').first().textContent(),firstProduct:await collection.getAttribute('href')};
if(!actualCollection.firstProduct)throw Error('Missing real product link');
await page.waitForTimeout(1200);
const preloadImages=await gettingPreloadImages;const product=catalogue[0]?.r.timing();
await context.close();const path=await vid.path();
await fs.rename(path,dir+'/'+phase+'.webm');
const json={phase,engine:'Playwright mobile WebKit emulating iPhone 13, 390 × 844, DPR 2',site,status:response.status(),actualCollection,measurement,outcome,catalogue:catalogue.map(x=>x.url),catalogueMs:product?Math.round(product.startTime-original):null,errors,preloadImages,navUnix:nav};
console.log('FILM_RESULT '+JSON.stringify(json));await fs.writeFile(dir+'/'+phase+'.json',JSON.stringify(json,null,2));
await browser.close();if(server)server.close();

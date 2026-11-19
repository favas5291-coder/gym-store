import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {webkit,devices} from 'playwright';
const base='https://www.gymdrobe.com';
const browser=await webkit.launch();
const ctx=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(()=>{
  if(location.pathname!=='/')return;
  const measure=window.journey={logo:false};
  const opened=()=>document.documentElement?.hasAttribute('data-opening-active');
  new MutationObserver(entries=>{if(opened() || entries.some(e=>e.attributeName==='data-opening-active' && e.oldValue!==null))measure.logo=true}).observe(document,{subtree:true,attributeFilter:['data-opening-active'],attributeOldValue:true});
  function tick(t){
    if(opened())measure.logo=true;
    for(const selector of ['#home-boot-shell a[href="/shop?gender=Women"]','#app a.department-tile[href="/shop?gender=Women"]']){
      const a=document.querySelector(selector);
      if(!a)continue;
      const r=a.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      if(r.width>0 && r.height>0 && a.contains(document.elementFromPoint(x,y))){
        if(!measure.ready){measure.ready=t;measure.point=[x,y];measure.firstSurface=selector.startsWith('#home')?'HTML shell':'React Home';}
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  document.addEventListener('click',e=>{
    const target=e.target.closest?.('a');
    if(target && target.getAttribute('href')==='/shop?gender=Women'){
      measure.tap=performance.now();measure.tapSurface=target.closest('#home-boot-shell')?'HTML shell':'React Home';
      sessionStorage.setItem('qa-last-member-tap',JSON.stringify(measure));
    }
  },true);
});
const page=await ctx.newPage();
const visit=async()=>{
  await page.goto(base+'/',{waitUntil:'commit'});
  const xy=await page.evaluate(()=>new Promise(ok=>{function tick(){if(window.journey?.point)ok(window.journey.point);else requestAnimationFrame(tick)}tick()}));
  await page.touchscreen.tap(...xy);
  await page.waitForURL(/shop\?gender=Women/);
  const product=page.locator('a[href^="/product/"]').first();await product.waitFor({timeout:30000});
  return {...await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-last-member-tap'))),destination:page.url(),product:await product.getAttribute('href')};
};
const first=await visit();
assert.ok(first.logo);assert.ok(first.tap>3000);
const second=await visit();
assert.equal(second.logo,false);assert.ok(second.tap<3000);assert.ok(second.product);
console.log('RETURNING '+JSON.stringify({first,second}));
await fs.mkdir('film',{recursive:true});await fs.writeFile('film/returning.json',JSON.stringify({first,second},null,2));await browser.close();

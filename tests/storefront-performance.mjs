// A reproducible lab sample, not field Core Web Vitals or a production guarantee.
import {preview} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {startStorefrontFixture,mockStorefront} from './storefront-fixture.mjs';
const {chromium}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE||'playwright');
const f=await startStorefrontFixture(4210);
const server=await preview({preview:{host:'127.0.0.1',port:4211,strictPort:true}});
const browser=await chromium.launch({headless:true,...(process.env.GYMDROBE_CHROMIUM_PATH?{executablePath:process.env.GYMDROBE_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const assets=await fs.readdir('dist/assets');
function built(value){
 if(Array.isArray(value))return value.map(built);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,built(v)]));
 if(typeof value==='string'&&value.startsWith('/src/assets/')){
  const original=decodeURIComponent(value.split('/').at(-1).split('?')[0]);const ext=path.extname(original),base=path.basename(original,ext);
  const match=assets.find(file=>file.startsWith(base+'-')&&file.endsWith(ext));return match?'/assets/'+match:value;
 }return value;
}
const samples=[];
try{
 for(const width of [390,1440])for(let run=1;run<=3;run++){
  const c=await browser.newContext({viewport:{width,height:960},reducedMotion:'no-preference'});await mockStorefront(c,built(f.products));
  await c.addInitScript(()=>{
   window.lab={lcp:0,cls:0};
   new PerformanceObserver(list=>{for(const entry of list.getEntries()){window.lab.lcp=entry.startTime;window.lab.lcpElement=entry.element?.tagName;}}).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.lab.cls+=entry.value;}).observe({type:'layout-shift',buffered:true});
  });
  const p=await c.newPage();const cdp=await c.newCDPSession(p);
  if(width===390){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  await p.goto('http://127.0.0.1:4211/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(width===390?9000:3500);
  const metrics=await p.evaluate(()=>({...window.lab,domContentLoaded:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,posterLoaded:document.querySelector('.cinema-poster img')?.naturalWidth>0,requests:performance.getEntriesByType('resource').length}));
  samples.push({width,run,...metrics});console.log('LAB',JSON.stringify(samples.at(-1)));await c.close();
 }
 const report={conditions:{browser:await browser.version(),host:'GitHub ubuntu-latest headless Chromium',server:'Vite production preview on localhost; no CDN/compression configured',catalog:'Test-only catalog and instant mocked APIs; external services blocked',cache:'Fresh browser context per run; three samples per viewport',desktop:'1440×960, no CPU/network throttle',mobile:'390×960, 4× CPU slowdown, 150 ms latency, 1.6 Mbps down / 0.75 Mbps up',motion:'Default motion; hero film enabled after poster',limitations:'LCP/CLS lab samples only. CLS is the sum of observed shifts in the measurement window. INP and field percentiles not measured.'},targets:{lcpMs:2500,inpMs:200,cls:0.1},samples};
 const output=process.env.STOREFRONT_ARTIFACTS||'test-results/storefront';await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'performance.json'),JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));await f.server.close();}

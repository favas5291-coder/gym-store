// Uses a synthetic image and mock provider. This exercises the real local HTTP API,
// not the paid FASHN service, and does not validate photorealism or physical fit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createTryOnServer } from '../server/tryon-server.mjs';
import { chart } from './fixtures/fit-chart.js';
import { testImage,imageData } from './fixtures/test-image.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let chromium;try{({chromium}=await import(process.env.GYMDROBE_PLAYWRIGHT_MODULE || 'playwright'));}catch{console.error('Install Playwright first: npm install --no-save --package-lock=false playwright');process.exit(1);}
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
let mode='success',starts=0;
const provider={start:async()=>{starts++;return'test-provider-job';},status:async()=>mode==='failed'?{status:'failed',message:'Try a clearer, fully clothed photo.'}:mode==='pending'?{status:'processing'}:{status:'completed',image:imageData()}};
const catalog={visible:{1:{name:'Gym Training T-Shirt',category:'tops',colors:['Black']}},approved:new Map([[JSON.stringify(['1','Black']),{image:imageData(),category:'tops'}]])};
const api=createTryOnServer({catalog,provider,allowedOrigins:['http://127.0.0.1:4197'],requestLimit:20,globalLimit:40});await new Promise(r=>api.listen(0,'127.0.0.1',r));
const vite=await createServer({root,server:{host:'127.0.0.1',port:4197,strictPort:true,proxy:{'/api/try-on':{target:`http://127.0.0.1:${api.address().port}`,changeOrigin:false}}},logLevel:'error'});await vite.listen();
const browser=await chromium.launch({executablePath:process.env.GYMDROBE_CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[],passed=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name);};
const open=async()=>{await page.getByRole('button',{name:/Try it on. Find your fit./}).click();await page.getByRole('dialog',{name:'Your fitting room',exact:true}).waitFor();};
const dialog=()=>page.getByRole('dialog',{name:'Your fitting room',exact:true});
const photo=async()=>{await dialog().locator('input[type=file]').first().setInputFiles({name:'test-grid.png',mimeType:'image/png',buffer:testImage()});await dialog().getByAltText('Your uploaded photo',{exact:true}).waitFor();};
try{
 await page.goto('http://127.0.0.1:4197/product/1');await page.getByRole('button',{name:/Try it on. Find your fit./}).waitFor();
 await check('fitting room opens; missing supplier data never produces a size',async()=>{
  await open();await dialog().getByRole('button',{name:'02 Find my size'}).click();await dialog().getByText('Measurement chart needed',{exact:true}).waitFor();assert.equal(await dialog().getByRole('button',{name:'Find my size',exact:true}).count(),0);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
 });
 await check('photo validation and consent gate generation',async()=>{
  await open();await dialog().locator('input[type=file]').first().setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await dialog().getByRole('alert').filter({hasText:'JPEG'}).waitFor();
  await photo();assert.equal(await dialog().getByRole('button',{name:'Generate my preview',exact:true}).isDisabled(),true);assert.equal(starts,0);
 });
 await check('real API pipeline with mock provider produces compare/download/reset controls',async()=>{
  await dialog().getByRole('checkbox',{name:/I have permission/}).check();await dialog().getByRole('button',{name:'Generate my preview',exact:true}).click();
  await dialog().getByRole('link',{name:'Download preview',exact:true}).waitFor();assert.equal(starts,1);
  await dialog().getByRole('button',{name:'Compare',exact:true}).click();const slider=dialog().getByRole('slider',{name:'Before and after comparison'});await slider.fill('25');assert.equal(await slider.inputValue(),'25');
  const download=page.waitForEvent('download');await dialog().getByRole('link',{name:'Download preview',exact:true}).click();assert.match((await download).suggestedFilename(),/GymDrobe-AI-preview-1/);
  const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.equal(saved.includes('data:image'),false);
  await dialog().getByRole('button',{name:'Remove photo and preview',exact:true}).click();assert.equal(await dialog().getByAltText('Your uploaded photo',{exact:true}).count(),0);assert.equal(await dialog().getByRole('link',{name:'Download preview',exact:true}).count(),0);await page.keyboard.press('Escape');
 });
 await check('unapproved colour cannot silently use another garment photo',async()=>{
  await page.locator('.product-options').getByRole('button',{name:'Blue',exact:true}).click();await open();await dialog().getByText('This colour needs a product photo',{exact:true}).waitFor();await photo();await dialog().getByRole('checkbox',{name:/I have permission/}).check();assert.equal(await dialog().getByRole('button',{name:'Generate my preview',exact:true}).isDisabled(),true);assert.equal(starts,1);await page.keyboard.press('Escape');await page.locator('.product-options').getByRole('button',{name:'Black',exact:true}).click();
 });
 await check('supplier range comparison applies the chosen size to the bag',async()=>{
  await page.evaluate(chart=>localStorage.setItem('gymdrobe-catalog-preview-v3',JSON.stringify([{id:1,name:'Gym Training T-Shirt',price:799,discount:10,fitProfile:chart}])),chart);await page.reload();await open();await dialog().getByRole('button',{name:'02 Find my size'}).click();await dialog().getByLabel('Chest (cm)',{exact:true}).fill('98');await dialog().getByLabel('Waist (cm)',{exact:true}).fill('82');await dialog().getByRole('button',{name:'Find my size',exact:true}).click();await dialog().getByRole('heading',{name:'Suggested size: M',exact:true}).waitFor();await dialog().getByRole('button',{name:'Choose M',exact:true}).click();
  assert.equal(await page.locator('.option-list.sizes').getByRole('button',{name:'M',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Add to bag',exact:true}).click();const bag=await page.evaluate(()=>JSON.parse(localStorage.getItem('gymdrobe-cart')));assert.equal(bag[0].selectedSize,'M');
 });
 await check('measurement validation, unit conversion and no-match state',async()=>{
  await open();await dialog().getByRole('button',{name:'02 Find my size'}).click();await dialog().getByRole('button',{name:'Find my size',exact:true}).click();assert.equal(await dialog().locator('[aria-invalid=true]').count(),2);
  await dialog().getByLabel('Chest (cm)',{exact:true}).fill('98');await dialog().getByLabel('Waist (cm)',{exact:true}).fill('82');await dialog().getByRole('button',{name:'inches',exact:true}).click();await dialog().getByRole('button',{name:'Find my size',exact:true}).click();await dialog().getByRole('heading',{name:'Suggested size: M',exact:true}).waitFor();await dialog().getByRole('button',{name:'cm',exact:true}).click();await dialog().getByLabel('Chest (cm)',{exact:true}).fill('150');await dialog().getByRole('button',{name:'Find my size',exact:true}).click();await dialog().getByRole('heading',{name:'No confirmed size match',exact:true}).waitFor();await page.keyboard.press('Escape');
 });
 await check('provider failures recover without showing a fake result',async()=>{
  mode='failed';await open();await photo();await dialog().getByRole('checkbox',{name:/I have permission/}).check();await dialog().getByRole('button',{name:'Generate my preview',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'Try a clearer'}).waitFor();assert.equal(await dialog().getByRole('link',{name:'Download preview',exact:true}).count(),0);await page.keyboard.press('Escape');mode='success';
 });
 await check('closing or stopping pending generation clears local UI',async()=>{
  mode='pending';await open();await photo();await dialog().getByRole('checkbox',{name:/I have permission/}).check();await dialog().getByRole('button',{name:'Generate my preview',exact:true}).click();await dialog().getByRole('button',{name:'Stop waiting',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'Preview stopped here'}).waitFor();await page.keyboard.press('Escape');await open();assert.equal(await dialog().getByAltText('Your uploaded photo',{exact:true}).count(),0);assert.equal(await dialog().getByRole('checkbox',{name:/I have permission/}).isChecked(),false);await page.keyboard.press('Escape');
 });
 await check('fitting room and size guide remain usable at mobile and desktop widths',async()=>{
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await open();assert.equal(await dialog().evaluate(d=>d.scrollWidth>d.clientWidth+1),false,`photo overflow ${width}`);await dialog().getByRole('button',{name:'02 Find my size'}).click();assert.equal(await dialog().evaluate(d=>d.scrollWidth>d.clientWidth+1),false,`fit overflow ${width}`);await page.keyboard.press('Escape');}
  await page.setViewportSize({width:1440,height:1000});await open();await page.screenshot({path:path.join(out,'tryon-desktop.png')});await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await open();await page.screenshot({path:path.join(out,'tryon-mobile.png')});await page.keyboard.press('Escape');
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'tryon-browser-report.json'),JSON.stringify({passed,errors,provider:'Mock provider with synthetic colour-grid PNG. No real customer images, paid calls, or realism validation.'},null,2));console.log(`Completed ${passed.length} try-on browser scenarios.`);
}catch(error){await page.screenshot({path:path.join(out,'tryon-failure.png'),fullPage:true});console.error(page.url());throw error;}
finally{await browser.close();await vite.close();await new Promise(r=>api.close(r));}
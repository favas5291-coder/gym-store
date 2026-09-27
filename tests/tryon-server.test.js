import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTryOnServer, loadTryOnCatalog } from '../server/tryon-server.mjs';
import { createFashnProvider } from '../server/fashn.mjs';
import { validateImage } from '../server/image-validation.mjs';
import { imageData,testImage } from './fixtures/test-image.js';
const origin='http://localhost:5173';
async function setup(t,{provider,requestLimit,now}={}){
 const data=imageData(),engine=provider || {model:'tryon-max',start:async()=> 'provider-1',status:async()=>({status:'completed',image:data})};
 const catalog={visible:{'1':{category:'tops',name:'Test shirt',colors:['Black']}},approved:new Map([[JSON.stringify(['1','Black']),{image:data,category:'tops'}]])};
 const server=createTryOnServer({catalog,provider:engine,requestLimit,now});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const first=await fetch(base+'/api/try-on/config?product=1');const cookie=first.headers.get('set-cookie').split(';')[0],config=await first.json();
 const headers={Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-GymDrobe-Token':config.csrf};
 const post=body=>fetch(base+'/api/try-on/jobs',{method:'POST',headers,body:JSON.stringify(body)});
 const body={productId:'1',color:'Black',personImage:data,consent:true,requestKey:'a-valid-request-key-00001'};
 return{base,headers,post,body,config};
}
test('server validates actual image type, dimensions and URL rejection',()=>{
 assert.equal(validateImage(imageData()).width,600);
 assert.throws(()=>validateImage('https://example.com/photo.jpg'));
 assert.throws(()=>validateImage('data:image/jpeg;base64,'+Buffer.from('not an image').toString('base64')));
 assert.throws(()=>validateImage('data:image/png;base64,'+testImage(100,100).toString('base64')));
});
test('catalog accepts only approved local photos within the asset directory',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gd-tryon-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'src/assets'),{recursive:true});await fs.writeFile(path.join(root,'src/assets/shirt.png'),testImage());await fs.writeFile(path.join(root,'outside.png'),testImage());
 const catalog=await loadTryOnCatalog(root,{products:{1:{enabled:true,name:'Shirt',category:'tops',colors:{Black:{approved:true,file:'src/assets/shirt.png'},Blue:{approved:false,file:'src/assets/shirt.png'},White:{approved:true,file:'outside.png'}}}}});
 assert.deepEqual(catalog.visible['1'].colors,['Black']);assert.equal(catalog.approved.size,1);
});
test('submission requires consent, approved colour, same origin and CSRF',async t=>{
 const {base,headers,post,body}=await setup(t);
 assert.equal((await post({...body,consent:false})).status,400);
 assert.equal((await post({...body,color:'Blue'})).status,422);
 assert.equal((await fetch(base+'/api/try-on/jobs',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify(body)})).status,403);
 assert.equal((await fetch(base+'/api/try-on/jobs',{method:'POST',headers:{...headers,'X-GymDrobe-Token':'wrong'},body:JSON.stringify(body)})).status,403);
});
test('repeated attempt creates one provider request and private output',async t=>{
 let starts=0;const {base,headers,post,body}=await setup(t,{provider:{start:async()=>{starts++;return'id-1';},status:async()=>({status:'completed',image:imageData()})}});
 const first=await(await post(body)).json(),second=await(await post(body)).json();assert.equal(first.id,second.id);assert.equal(starts,1);
 const response=await fetch(base+'/api/try-on/jobs/'+first.id,{headers});const output=await response.json();assert.equal(output.status,'completed');assert.equal(response.headers.get('cache-control'),'no-store, private');
 const other=await fetch(base+'/api/try-on/config?product=1');const cookie=other.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/try-on/jobs/'+first.id,{headers:{Cookie:cookie}})).status,404);
 assert.equal((await fetch(base+'/api/try-on/jobs/'+first.id,{method:'DELETE',headers})).status,200);assert.equal((await fetch(base+'/api/try-on/jobs/'+first.id,{headers})).status,404);
});
test('session request limit is enforced and expired jobs disappear',async t=>{
 let clock=Date.now();const {base,headers,post,body}=await setup(t,{requestLimit:1,now:()=>clock});
 const first=await(await post(body)).json();await fetch(base+'/api/try-on/jobs/'+first.id,{headers});
 assert.equal((await post({...body,requestKey:'a-valid-request-key-00002'})).status,429);
 clock+=16*60*1000;assert.equal((await fetch(base+'/api/try-on/jobs/'+first.id,{headers})).status,404);
});
test('delete during processing hides a job without freeing provider concurrency',async t=>{
 const {base,headers,post,body}=await setup(t,{provider:{start:async()=> 'id-1',status:async()=>({status:'processing'})}});
 const first=await(await post(body)).json();await fetch(base+'/api/try-on/jobs/'+first.id,{method:'DELETE',headers});
 assert.equal((await fetch(base+'/api/try-on/jobs/'+first.id,{headers})).status,404);
 assert.equal((await post({...body,requestKey:'a-valid-request-key-00002'})).status,409);
});
test('production mode cannot rely on frontend accounts',()=>{
 assert.throws(()=>createTryOnServer({catalog:{},production:true}),/server-side authorize/);
});
test('FASHN adapter uses fixed endpoint, base64 output and exact current schema',async()=>{
 const requests=[];const provider=createFashnProvider({apiKey:'unit-test-key',fetchImpl:async(url,options)=>{requests.push([url,options]);return new Response(JSON.stringify(url.endsWith('/run')?{id:'prediction-1'}:{status:'completed',output:[imageData()]}),{status:200});}});
 assert.equal(await provider.start({personImage:imageData(),productImage:imageData(),category:'tops'}),'prediction-1');
 const sent=JSON.parse(requests[0][1].body);assert.equal(sent.model_name,'tryon-max');assert.equal(sent.inputs.generation_mode,'quality');assert.equal(sent.inputs.resolution,'2k');assert.equal(sent.inputs.return_base64,true);assert.equal(sent.inputs.num_images,1);assert.equal(sent.inputs.garment_image,undefined);assert.equal((await provider.status('prediction-1')).status,'completed');assert.equal(requests[0][0],'https://api.fashn.ai/v1/run');
});
test('provider failures expose no secrets or upstream payloads',async()=>{
 const provider=createFashnProvider({apiKey:'never-show-me',fetchImpl:async()=>new Response('private upstream payload',{status:401})});
 await assert.rejects(()=>provider.start({}),e=>!e.message.includes('never-show-me')&&!e.message.includes('private upstream'));
});
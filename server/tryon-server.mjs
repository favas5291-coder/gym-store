import http from 'node:http';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TryOnError, validateImage } from './image-validation.mjs';
import { createFashnProvider } from './fashn.mjs';
const random = () => randomBytes(24).toString('hex');
const JOB_TTL = 15*60*1000, SESSION_TTL = 30*60*1000;
const MAX_BODY = 12*1024*1024;
const validCategory = category => ['tops','bottoms','one-pieces','shoes','bags','accessories'].includes(category);
export async function loadTryOnCatalog(root, config) {
  const approved = new Map(), visible = {};
  const base = await fs.realpath(path.join(root,'src/assets'));
  for (const [id,item] of Object.entries(config?.products || {})) {
    if (!item.enabled || !validCategory(item.category)) continue;
    visible[id] = {name:item.name,category:item.category,colors:[]};
    for (const [color,asset] of Object.entries(item.colors || {})) {
      if (asset.approved !== true || typeof asset.file !== 'string') continue;
      try {
        const file = await fs.realpath(path.resolve(root,asset.file));
        if (!file.startsWith(base+path.sep)) continue;
        const info = await fs.stat(file);if (!info.isFile() || info.size > 8*1024*1024) continue;
        const bytes = await fs.readFile(file), type = bytes[0] === 137 ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${type};base64,${bytes.toString('base64')}`;
        validateImage(dataUrl,{minSide:384});
        approved.set(JSON.stringify([String(id),color]),{image:dataUrl,category:item.category});visible[id].colors.push(color);
      } catch { /* Unapproved/missing/invalid reference assets are not advertised as ready. */ }
    }
  }
  return {approved,visible};
}
export function createTryOnServer({root, catalog, apiKey = '', model = 'tryon-max', provider, allowedOrigins = ['http://localhost:5173','http://127.0.0.1:5173'], production = false, authorize, sessionLimit = 1000, requestLimit = 5, globalLimit = 30, now = () => Date.now()}) {
  if (production && typeof authorize !== 'function') throw new Error('Production try-on requires a server-side authorize(request) integration. Browser-local accounts are not authorization.');
  const engine = provider || (apiKey ? createFashnProvider({apiKey,model}) : null);
  const sessions = new Map(), jobs = new Map(), origins = new Set(allowedOrigins), allowedHosts = new Set(allowedOrigins.map(v=>new URL(v).host));
  let globalAttempts = [];
  function clean() {
    const time=now();for(const [key,value] of sessions)if(value.expires<time)sessions.delete(key);
    for(const [key,value] of jobs) {
      if(!['failed','completed'].includes(value.status) && time-value.created>180000){value.status='failed';value.message='This preview took too long. Try again later.';}
      if(value.expires<time || !sessions.has(value.session) || (value.forgotten && ['failed','completed'].includes(value.status)))jobs.delete(key);
    }
    globalAttempts=globalAttempts.filter(t=>time-t<3600000);
  }
  function json(res,status,body) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(body));}
  async function readBody(req) {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new TryOnError(415,'Send application/json.');
    if (Number(req.headers['content-length'] || 0)>MAX_BODY) throw new TryOnError(413,'The photo is too large.');
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw new TryOnError(413,'The photo is too large.');chunks.push(chunk);}
    try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new TryOnError(400,'Invalid request.');}
  }
  async function getSession(req,res) {
    const owner = production ? await authorize(req) : 'local-preview';
    if (typeof owner !== 'string' || !owner) throw new TryOnError(401,'Sign in to use virtual try-on.');
    const cookieName = production ? '__Host-gdtryon' : 'gdtryon';
    const token = String(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    let session = sessions.get(token);
    if (!session || session.owner !== owner) {
      if(req.method!=='GET' || !req.url.startsWith('/api/try-on/config'))throw new TryOnError(401,'Reopen the fitting room to start a new session.');
      if(sessions.size>=sessionLimit)throw new TryOnError(503,'The fitting room is busy. Please try again shortly.');
      session={id:random(),csrf:random(),owner,expires:now()+SESSION_TTL,attempts:[]};sessions.set(session.id,session);
      res.setHeader('Set-Cookie',`${cookieName}=${session.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${production ? '; Secure' : ''}`);
    }
    // Expiration is absolute, matching the cookie lifetime.
    return session;
  }
  async function poll(job) {
    if (job.status === 'completed' || job.status === 'failed') return;
    if(now()-job.created>180000){job.status='failed';job.message='This preview took too long. Try again later.';return;}
    if(!job.providerId || now()-job.lastPoll<2000)return;
    if(job.polling)return job.polling;
    job.lastPoll=now();
    job.polling=(async()=>{try{const result=await engine.status(job.providerId);Object.assign(job,result);}catch{job.status='failed';job.message='The preview service is unavailable. Please try again later.';}finally{job.polling=null;}})();
    return job.polling;
  }
  const server=http.createServer(async(req,res)=>{
    try {
      clean();
      if(!req.url?.startsWith('/api/try-on/'))return json(res,404,{message:'Not found.'});
      // Origin allowlist also prevents cross-site paid requests. Do not use wildcard CORS.
      if(req.headers.origin && !origins.has(req.headers.origin))throw new TryOnError(403,'This website is not allowed to use the fitting room.');
      if(req.headers['sec-fetch-site']==='cross-site')throw new TryOnError(403,'Cross-site requests are not allowed.');
      const localHost = String(req.headers.host || '');
      if(!allowedHosts.has(localHost) && localHost !== `127.0.0.1:${server.address()?.port}` && localHost !== `localhost:${server.address()?.port}`)throw new TryOnError(403,'Unexpected request host.');
      if(!['GET','POST','DELETE'].includes(req.method))throw new TryOnError(405,'Method not allowed.');
      const url=new URL(req.url,'http://localhost'), session=await getSession(req,res);
      if(req.method!=='GET' && (!origins.has(req.headers.origin) || req.headers['x-gymdrobe-token']!==session.csrf))throw new TryOnError(403,'Reopen the fitting room and try again.');
      if(req.method==='GET' && url.pathname==='/api/try-on/config') {
        const item=catalog.visible[url.searchParams.get('product')] || null;
        const supported=item && (model!=='tryon-v1.6' || ['tops','bottoms','one-pieces'].includes(item.category));
        return json(res,200,{configured:Boolean(engine),csrf:session.csrf,provider:'FASHN',model,product:supported?item:null,privacyUrl:'https://docs.fashn.ai/api-overview/data-retention-privacy'});
      }
      if(req.method==='POST' && url.pathname==='/api/try-on/jobs') {
        if(!engine)throw new TryOnError(503,'Photo previews are not available yet. You can still explore the size guide.','NOT_CONFIGURED');
        const body=await readBody(req);
        if(body.consent!==true)throw new TryOnError(400,'Consent is required before your photo can be processed.');
        if(typeof body.requestKey!=='string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey))throw new TryOnError(400,'Invalid preview request.');
        const previous=[...jobs.values()].find(j=>j.session===session.id && j.requestKey===body.requestKey);
        if(previous)return json(res,202,{id:previous.id,status:previous.status});
        const product=catalog.approved.get(JSON.stringify([String(body.productId),String(body.color)]));
        if(!product || (model==='tryon-v1.6' && !['tops','bottoms','one-pieces'].includes(product.category)))throw new TryOnError(422,'A verified photo for this colour is not available yet.');
        validateImage(body.personImage);
        const active=[...jobs.values()].filter(j=>!['failed','completed'].includes(j.status));
        if(active.some(j=>j.session===session.id))throw new TryOnError(409,'A preview is already processing. Wait for it to finish.');
        session.attempts=session.attempts.filter(t=>now()-t<3600000);
        if(session.attempts.length>=requestLimit || globalAttempts.length>=globalLimit || active.length>=4)throw new TryOnError(429,'The preview limit has been reached. Please try again later.');
        session.attempts.push(now());globalAttempts.push(now());
        const job={id:random(),session:session.id,requestKey:body.requestKey,status:'starting',created:now(),expires:now()+JOB_TTL,lastPoll:0,productId:String(body.productId),color:String(body.color)};
        jobs.set(job.id,job);
        // No photo writes to disk, database or logs. Input is released after submission.
        engine.start({personImage:body.personImage,productImage:product.image,category:product.category}).then(id=>{job.providerId=id;job.status='in_queue';}).catch(()=>{job.status='failed';job.message='The preview could not be started. Please try again later.';});
        return json(res,202,{id:job.id,status:job.status});
      }
      const match=/^\/api\/try-on\/jobs\/([a-f0-9]{48})$/.exec(url.pathname),job=match?jobs.get(match[1]):null;
      if(!job || job.forgotten || job.session!==session.id)throw new TryOnError(404,'This preview expired or is no longer available.');
      if(req.method==='DELETE'){if(['failed','completed'].includes(job.status))jobs.delete(job.id);else job.forgotten=true;return json(res,200,{removed:true});}
      if(req.method==='GET'){await poll(job);return json(res,200,{id:job.id,status:job.status,image:job.status==='completed'?job.image:undefined,message:job.message,productId:job.productId,color:job.color});}
      throw new TryOnError(405,'Method not allowed.');
    }catch(error){if(!res.headersSent)json(res,error instanceof TryOnError?error.status:500,{message:error instanceof TryOnError?error.message:'The fitting room is temporarily unavailable.',code:error instanceof TryOnError?error.code:'SERVER_ERROR'});else res.end();}
  });
  const timer=setInterval(clean,60000);timer.unref();server.on('close',()=>{clearInterval(timer);sessions.clear();jobs.clear();});
  server.requestTimeout=30000;server.headersTimeout=10000;
  return server;
}
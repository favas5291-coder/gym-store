import asyncio,base64,functools,json,mimetypes,os,sys,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
BASE=Path(__file__).parent
portdir=Path(sys.argv[1]).resolve(); phase=sys.argv[2]; engines=sys.argv[3].split(','); cases=sys.argv[4].split(',');out=BASE/'results'/phase;out.mkdir(exist_ok=True,parents=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  if not Path(self.translate_path(self.path)).is_file():self.path='/index.html'
  return super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(portdir)))
threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
pid='000000000000000000000001'
product={'id':pid,'_id':pid,'name':'GymDrobe test training tee','images':['/media/campaign/women-hoodie-432.webp?v=3'],'image':'/media/campaign/women-hoodie-432.webp?v=3','price':699,'category':'T-shirts','gender':'Women','stock':3,'isActive':True,'colors':[],'sizes':[],'reviewCount':0}
probe="""(() => {
const a=window.oqa={frames:[],ever:false,requests:[],creq:0};
let prev='',oldFetch=window.fetch;window.fetch=function(u,...args){if(new URL(u,location.href).pathname==='/api/products'){a.requests.push(+performance.now().toFixed(1));a.creq++}return oldFetch.apply(this,arguments)};
function sample(){const s=document.querySelector('#gymdrobe-opening'),l=s?.querySelector('img'),show=!!(s&&getComputedStyle(s).display!=='none'&&l?.complete&&l.naturalWidth&&l.getBoundingClientRect().width);
const shell=document.querySelector('#home-boot-shell'), h=window.getComputedStyle, hasShell=!!(shell?.isConnected && h(shell).display!=='none'&&!shell.inert), t=Array.from(document.querySelectorAll('.department-tile[href*="Women"],#home-boot-shell a[href*="Women"]')).find(el=>{let b=el.getBoundingClientRect();return b.width>0&&!el.closest('[inert]') && document.elementFromPoint(b.x+b.width/2,Math.min(innerHeight-1,b.y+b.height/2))?.closest('a')===el});
if(show){a.ever=true;if(a.logo==null)a.logo=performance.now()} else if(a.ever&&a.closed==null)a.closed=performance.now();
if(t){if(a.tapReady==null){a.tapReady=performance.now();a.readyPhoto=!!t.querySelector('img')?.naturalWidth;}a.target=t}
let stat=[show,hasShell,!!t,!!document.querySelector('#app .department-tile')].join('|');if(stat!==prev){a.frames.push({t:Math.round(performance.now()),state:stat});prev=stat;}requestAnimationFrame(sample)}
requestAnimationFrame(sample);document.addEventListener('click',e=>{if(e.target.closest('a')?.href.includes('gender=Women'))a.tap=performance.now()},true);})();"""
async def test(p,b,eng,case):
 args=dict(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block',reduced_motion='reduce')
 if eng=='desktop':args.update(viewport={'width':1440,'height':900},is_mobile=False,has_touch=False)
 if case=='native':args.update()
 ctx=await b.new_context(**args);await ctx.add_init_script(probe);req=[];imgs=[];errors=[];cat=0;tasks=[]
 if case=='shortcut':await ctx.add_init_script('Object.defineProperty(navigator,"standalone",{value:true});')
 if case=='native':await ctx.add_init_script('window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"ios"};')
 if case in ('return','returncss','returncssfail','returnblocked'):await ctx.add_init_script('localStorage.setItem("gymdrobe.web-opening.seen.v1","1")')
 async def route(r):
  nonlocal cat
  u=urlsplit(r.request.url);path=u.path
  if path.startswith('/api/'):
   status=200;v={'success':True,'config':{'enabled':False},'settings':{},'reviews':[],'products':[]}
   if path=='/api/products':
    cat+=1;v={'success':True,'products':[product],'total':1}
    if case=='catfail' and cat==1:status=503;v={'success':False,'message':'Test temporarily unavailable'}
    if case=='catalogslow':await asyncio.sleep(7)
   elif path.endswith(pid):v={'success':True,'product':product}
   return await r.fulfill(status=status,json=v,headers={'Access-Control-Allow-Origin':'*','Timing-Allow-Origin':'*'})
  if u.netloc!=urlsplit(origin).netloc:return await r.abort()
  if '/assets/index-' in path and path.endswith('.js'):
   if case in ('blocked','returnblocked'):return await r.abort()
   if case=='slowjs':await asyncio.sleep(7)
  if '/assets/' in path and path.endswith('.css'):
   if case in ('slowcss','returncss'):await asyncio.sleep(7)
   if case in ('returncssfail','cssfail'):return await r.abort()
  if 'women-hoodie' in path:
   if case=='failphoto':return await r.abort()
   if case=='slowphoto':await asyncio.sleep(7)
  return await r.continue_()
 await ctx.route('**/*',route);pg=await ctx.new_page();pg.set_default_timeout(10500);pg.on('pageerror',lambda e:errors.append(str(e)));path={'deep':'/product/'+pid,'search':'/search?q=tee','cart':'/cart','checkout':'/checkout','tracking':'/orders/000000000000000000000002/track','payment':'/order-success?orderId=000000000000000000000002'}.get(case,'/')
 await pg.goto(origin+path,wait_until='commit')
 async def metric():
  return await pg.evaluate("""()=>{const a=window.oqa;return {photoNow:[...document.querySelectorAll('#app .department-tile[href*="Women"] img')].map(x=>x.complete&&x.naturalWidth>0),documentBoot:Number(document.documentElement.dataset.homeBoot),recoveryVisible:[...document.querySelectorAll('[data-boot-reload]')].some(x=>{const b=x.getBoundingClientRect();return b.width>0&&x.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}),logo:a.logo??null,closed:a.closed??null,tapReady:a.tapReady??null,catalogue:a.requests,readyPhoto:a.readyPhoto,frames:a.frames,tap:a.tap??null,marks:performance.getEntriesByType('mark').map(x=>[x.name,Math.round(x.startTime)]),path:location.pathname,search:location.search,body:document.body?.innerText.slice(0,180),reload:[...document.querySelectorAll('button,a')].filter(x=>x.offsetWidth>0&&/retry|reload|refresh|try again/i.test(x.textContent)).map(x=>x.textContent.trim()),bytes:performance.getEntriesByType('resource').filter(x=>x.initiatorType==='img').reduce((n,x)=>n+x.encodedBodySize,0),catalogueFetchStart:performance.getEntriesByType('resource').filter(x=>new URL(x.name).pathname==='/api/products').map(x=>x.startTime)}}""")
 result={'engine':eng,'case':case}
 try:
  if case in ('fresh','shortcut','failphoto','slowphoto','slowjs','slowcss','catalogslow','catfail','blocked','refresh','back','hidden','swipe','cssfail'):
   if case in ('hidden','swipe'):
    await pg.wait_for_function('window.oqa?.ever')
    await pg.wait_for_timeout(650)
    if case=='swipe':
     if eng=='chromium':
      cd=await ctx.new_cdp_session(pg)
      await cd.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':170,'y':660}]})
      for y in range(600,99,-50):
       await cd.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':170,'y':y}]});await pg.wait_for_timeout(20)
      await cd.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
     else:result['touchAutomation']='WebKit mobile trusted swipe unavailable; separate Chromium CDP touch exercise.'
     await pg.wait_for_timeout(200);result['scrollDuring']=await pg.evaluate('scrollY')
    else:
     # Emulate foreground/hidden events with wall clock advancing; no physical app switch.
     await pg.evaluate('''()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}''')
     await pg.wait_for_timeout(3500)
     result['dismissedWhileHidden']=await pg.evaluate("!document.documentElement.hasAttribute('data-opening-active')")
     await pg.evaluate('''()=>{delete document.visibilityState;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}''')
   if case=='refresh':
    await pg.wait_for_function('window.oqa?.ever');await pg.wait_for_timeout(200);await pg.reload(wait_until='commit');await pg.wait_for_timeout(1000)
   else:
    await pg.wait_for_function('window.oqa?.closed!=null')
   if case=='swipe':result['scrollAfter']=await pg.evaluate('scrollY')
   if case in ('blocked','cssfail'):await pg.wait_for_timeout(150)
   if case=='fresh' or case=='back':
    await pg.wait_for_function('window.oqa.tapReady!=null')
    result['beforeTap']=await metric()
    xy=await pg.evaluate("()=>{const b=window.oqa.target.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]}")
    if eng=='desktop':await pg.mouse.click(*xy)
    else:await pg.touchscreen.tap(*xy)
    await pg.wait_for_url('**/shop?gender=Women',wait_until='commit')
    result['tapMs']=await pg.evaluate('()=>window.oqa.tap');result['destination']=pg.url;result['destinationHeading']=await pg.locator('h1').first.inner_text(timeout=5000)
    if case=='back':await pg.go_back(wait_until='commit');await pg.wait_for_timeout(350)
   if case=='catfail':
    retry=pg.get_by_role('button',name='Retry collection');await retry.click();await pg.wait_for_selector('#featured');result['retrySuccess']=True
   if case in ('slowjs','slowphoto','catalogslow'):result['atReveal']=await metric();await pg.wait_for_timeout(1700)
  elif case in ('returncss','returncssfail','returnblocked'):
   await pg.wait_for_timeout(1000);result['startup']=await metric();await pg.wait_for_timeout(5600)
  else:await pg.wait_for_timeout(1200)
  result.update(await metric())
 except Exception as e:result['error']=str(e)
 if case in ('fresh','blocked','swipe') and eng in ('chromium','webkit'):await pg.screenshot(path=str(out/f'{eng}-{case}.png'))
 result['pageErrors']=errors;result['catalogueCount']=cat
 await ctx.close();print(phase,eng,case,json.dumps({k:result.get(k) for k in ('error','logo','closed','tapReady','catalogueCount','reload','tapMs','retrySuccess')}),flush=True);(out/f'{eng}-{case}.json').write_text(json.dumps(result,indent=2));return result
async def main():
 async with async_playwright() as p:
  for e in engines:
   b=await (p.webkit.launch() if e=='webkit' else p.chromium.launch(args=['--no-sandbox']))
   try:
    for i in range(0,len(cases),3):await asyncio.gather(*(test(p,b,e,c) for c in cases[i:i+3]))
   finally:await b.close()
asyncio.run(main())

import base64,os,json,subprocess,time,urllib.request,xml.etree.ElementTree as ET,re
from pathlib import Path
from websocket import create_connection
E=Path('evidence');phase=os.environ['PHASE'];before=phase=='before';n=0
A=lambda *args:subprocess.check_output(['adb',*args],timeout=15)
def screen(label): (E/(label+'.png')).write_bytes(A('exec-out','screencap','-p'))
def tabs(): return json.load(urllib.request.urlopen('http://localhost:9222/json',timeout=3))
for attempt in range(22):
 try:
  pages=[p for p in tabs() if p.get('type')=='page']; target=next((p for p in pages if 'localhost:4183' in p['url']),None)
  if target:break
 except Exception: pass
 try:
  A('shell','uiautomator','dump','/sdcard/keyboard-ui.xml'); tree=ET.fromstring(A('shell','cat','/sdcard/keyboard-ui.xml')); options=[]
  for node in tree.iter('node'):
   name=node.get('text','').lower();desc=node.get('content-desc','').lower(); btn=node.get('resource-id','').lower()
   if name in ('use without an account','continue without an account','continue as guest','accept & continue','no thanks','not now','continue','skip','got it','use without account','open chrome') or 'signin_fre_dismiss_button' in btn or 'terms_accept' in btn:
    options.append((name,desc,node.get('bounds')))
  print('native onboarding',options)
  if options:
   x,y,x1,y1=map(int,re.findall(r'\d+',options[0][2])); A('shell','input','tap',str((x+x1)//2),str((y+y1)//2))
  elif attempt in (3,7,14): A('shell','am','start','-a','android.intent.action.VIEW','-d','http://localhost:4183/','-p','com.android.chrome')
 except Exception as e: print('native probe',e)
 time.sleep(1)
else: raise Exception('Chrome debugging target did not open '+str(tabs()))
ws=create_connection(target['webSocketDebuggerUrl'],timeout=20,suppress_origin=True); raw=Path('/tmp/search-catalogue.json').read_bytes(); products=json.loads(raw).get('products',[])
print('chrome',target['title'],'products',len(products)); pending={}
def send(method,params={}):
 global n
 n+=1;ws.send(json.dumps(dict(id=n,method=method,params=params)));return n
def call(method,params={}):
 rid=send(method,params)
 while True:
  data=json.loads(ws.recv()); event=data.get('method',''); v=data.get('params',{})
  if event=='Fetch.requestPaused':
   url=v['request']['url'];oid=url.split('?')[0].rsplit('/',1)[-1];headers=[{'name':'Content-Type','value':'application/json'},{'name':'Access-Control-Allow-Origin','value':'http://localhost:4183'},{'name':'Access-Control-Allow-Credentials','value':'true'}];record=next((p for p in products if str(p.get('_id') or p.get('id'))==oid),None)
   body=raw if oid=='products' else json.dumps({'success':True,'product':record} if record else {'success':True,'settings':{},'products':[]}).encode();send('Fetch.fulfillRequest',{'requestId':v['requestId'],'responseCode':200,'responseHeaders':headers,'body':base64.b64encode(body).decode()});continue
  if data.get('id')==rid:
   if 'error' in data:raise RuntimeError(data['error'])
   return data.get('result',{})
def ev(expr): return call('Runtime.evaluate',{'expression':expr,'returnByValue':True}).get('result',{}).get('value')
def wait(expr,t=15):
 end=time.time()+t
 while time.time()<end:
  val=ev(expr)
  if val:return val
  time.sleep(.12)
 raise AssertionError(expr+' : '+str(ev('document.body.innerText.slice(0,800)')))
def calltap(expr):
 xy=wait('(()=>{const el='+expr+'; if(!el)return;const b=el.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;return b.width&&b.height&&el.contains(document.elementFromPoint(x,y))?[x,y]:null})()')
 call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':xy[0],'y':xy[1]}]});call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
call('Fetch.enable',{'patterns':[{'urlPattern':'https://gym-drobe-backend.onrender.com/api/*'}]});ev("localStorage.removeItem('gymdrobe.web-opening.seen.v1')");call('Page.navigate',{'url':'http://localhost:4183/'})
wait("document.querySelector('#app .department-tile') && !document.querySelector('#gymdrobe-opening') && !document.querySelector('#home-boot-shell')",21);sleepjs=lambda t: [ev('1') or 0 for _ in range(t) if not time.sleep(.2)]
sleepjs(3);screen('01-home');vp=ev('visualViewport.height');inp="[...document.querySelectorAll('input[type=search],input[role=combobox]')].find(el=>el.getBoundingClientRect().width>0)";result={'phase':phase,'closedKeyboardViewport':vp,'innerWidth':ev('innerWidth'),'chrome':ev('navigator.userAgent'),'catalogueEntries':len(products)}
if before: calltap("document.querySelector('button[aria-label=\"Open search\"]')")
calltap(inp);wait('visualViewport.height<'+str(vp-90));sleepjs(2);result['keyboardViewport']=ev('visualViewport.height');screen('02-focused');print('keyboard',vp,result['keyboardViewport']);A('shell','input','text','black%sgym%stee');sleepjs(7);screen('03-typed');result['typed']=ev('document.activeElement.value');result['visibleOptions']=ev("[...document.querySelectorAll('[role=option], .gn-results a')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.top<visualViewport.height&&b.bottom>0}).map(e=>e.innerText)")
if not before:
 p="[...document.querySelectorAll('a[href^=\"/product/\"]')].find(el=>{const b=el.getBoundingClientRect();return b.width&&b.top>0&&b.bottom<=visualViewport.height&&el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))})";r=wait('(()=>{const a='+p+';return a && [a.href,a.innerText]})()');result['product']=r;assert '₹' in r[1];calltap(p);wait("location.pathname.startsWith('/product/') && document.querySelector('h1')");sleepjs(6);screen('04-product');result['destination']=ev('location.href');result['title']=ev('document.querySelector("h1")?.innerText')
(E/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

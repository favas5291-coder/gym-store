from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from pathlib import Path
import json,os
phase=os.environ['PHASE']; latest={}
doc=Path('source/dist/index.html').read_text()
# Keep the released app, inputs, layout and focus untouched. Use a read-only
# public-catalogue capture so the localhost simulator never needs cross-origin cookies.
bridge="""<script>
const f=window.fetch.bind(window);window.fetch=(input,init)=>{const u=new URL(input?.url||input,location.href);return f(u.host==='gym-drobe-backend.onrender.com'?'/fixture'+u.pathname:input,init)};
let prior='';setInterval(()=>{let s={url:location.pathname,value:document.activeElement?.value||'',focus:document.activeElement?.tagName,vp:visualViewport.height,w:innerWidth,options:[...document.querySelectorAll('[role=option],.gn-results a')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.top>0&&b.bottom<=visualViewport.height}).slice(0,6).map(e=>({text:e.innerText,href:e.getAttribute('href')}))};let line=JSON.stringify(s);if(line!==prior){prior=line;navigator.sendBeacon('/probe',line)}},200);
</script>"""
doc=doc.replace('<head>','<head>'+bridge,1)
catalogue=Path('/tmp/search-catalogue.json').read_bytes();rows=json.loads(catalogue).get('products',[])
os.chdir('source/dist')
class Handler(SimpleHTTPRequestHandler):
 def reply(self,body,kind):
  self.send_response(200);self.send_header('Content-type',kind);self.send_header('Content-length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_POST(self):
  if self.path=='/probe':
   global latest
   latest=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
   print('PHONE',json.dumps(latest,ensure_ascii=False),flush=True)
  self.send_response(204);self.end_headers()
 def do_GET(self):
  p=urlsplit(self.path).path;id=p.rsplit('/',1)[-1]
  if p=='/qa-state':return self.reply(json.dumps(latest).encode(),'application/json')
  if p.startswith('/fixture/api/'):
   r=next((x for x in rows if str(x.get('_id') or x.get('id'))==id),None)
   val=catalogue if p=='/fixture/api/products' else json.dumps({'success':True,'product':r} if r else {'success':True,'products':[],'config':{},'settings':{}}).encode()
   return self.reply(val,'application/json')
  if p=='/' or not Path('.'+p).is_file():return self.reply(doc.encode(),'text/html; charset=utf-8')
  return super().do_GET()
ThreadingHTTPServer(('127.0.0.1',4193),Handler).serve_forever()

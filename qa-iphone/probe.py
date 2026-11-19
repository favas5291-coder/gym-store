from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/probe':
            print('PHONE_RESULT', self.rfile.read(int(self.headers.get('Content-Length', 0))).decode(), flush=True)
        self.send_response(204)
        self.end_headers()
    def do_GET(self):
        if self.path in ['/','/index.html']:
            html=Path('dist/index.html').read_text()
            probe="""<script>(()=>{let sent=false;function sample(){const t=document.querySelector('.department-tile[href="/shop?gender=Women"]');if(t&&!document.querySelector('#gymdrobe-opening')&&!document.querySelector('#home-boot-shell')){if(!sent)navigator.sendBeacon('/probe',JSON.stringify({standalone:navigator.standalone,mode:matchMedia('(display-mode: standalone)').matches,logo:performance.getEntriesByName('gymdrobe-logo-visible')[0]?.startTime,dismiss:performance.getEntriesByName('gymdrobe-opening-dismissed')[0]?.startTime,tap:document.elementFromPoint(t.getBoundingClientRect().x+20,t.getBoundingClientRect().y+20)?.closest('a')?.getAttribute('href'),width:innerWidth,height:innerHeight}));sent=true;}if(!sent)requestAnimationFrame(sample)}requestAnimationFrame(sample)})();</script>"""
            data=html.replace('</body>',probe+'</body>').encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        self.path='/dist'+self.path
        super().do_GET()
ThreadingHTTPServer(('127.0.0.1',4193),Handler).serve_forever()

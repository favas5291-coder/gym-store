from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from pathlib import Path
import os
os.chdir('source/dist')
class Handler(SimpleHTTPRequestHandler):
  def do_GET(self):
    p=urlsplit(self.path).path
    if not Path('.'+p).is_file(): self.path='/index.html'
    return super().do_GET()
ThreadingHTTPServer(('127.0.0.1',4183),Handler).serve_forever()

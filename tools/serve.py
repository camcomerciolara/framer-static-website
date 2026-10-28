import http.server, os, sys
root=sys.argv[1] if len(sys.argv)>1 else '.'
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=root,**k)
    def send_head(s):
        p=s.path.split('?')[0].split('#')[0]
        fp=os.path.join(root,p.lstrip('/'))
        if not os.path.splitext(p)[1] and not os.path.isdir(fp) and os.path.exists(fp+'.html'):
            s.path=p+'.html'
        return super().send_head()
    def log_message(s,*a): pass
H.extensions_map['.mjs']='text/javascript'
http.server.ThreadingHTTPServer(('127.0.0.1',8080),H).serve_forever()

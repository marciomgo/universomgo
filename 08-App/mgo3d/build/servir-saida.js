// Servidor local so para TESTAR: serve saida/ e, no que faltar (imagens, service worker), a pasta docs/ do site publicado.
const http=require('http'),fs=require('fs'),path=require('path');
const A=path.join(__dirname,'..','saida'),B='C:/Users/55519/Desktop/sitemeuguiaoutdoor/docs';
const tipos={'.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png','.js':'text/javascript'};
http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);
 const f=[A,B].map(d=>path.join(d,u==='/'?'jogo.html':u)).find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
 if(!f){r.writeHead(404);return r.end();}
 r.writeHead(200,{'Content-Type':tipos[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));}).listen(8772,()=>console.log('http://localhost:8772/jogo-parcao.html'));

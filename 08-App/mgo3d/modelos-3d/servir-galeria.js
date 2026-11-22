// Servidor local so para ver a galeria de monstros 3D (porta 8774): serve esta pasta (modelos-3d/). Uso: node modelos-3d/servir-galeria.js -> http://localhost:8774/galeria.html
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = __dirname;
const tipos = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.gltf': 'model/gltf+json', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]).replace(/\.\./g, '');
  const f = path.join(RAIZ, u === '/' ? 'galeria.html' : u);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(fs.readFileSync(f));
}).listen(8774, () => console.log('http://localhost:8774/galeria.html'));

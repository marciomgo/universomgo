// Servidor local so para ver a galeria de modelos 3D (porta 8774): serve esta pasta (modelos-3d/). Uso: node modelos-3d/servir-galeria.js -> http://localhost:8774/galeria.html
// Tambem aceita POST /salvar?nome=<arquivo> (so para gerar as imagens do menu: galeria.html?gerar=1 grava em menu/).
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = __dirname;
const tipos = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.gltf': 'model/gltf+json', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer((q, r) => {
  const partes = q.url.split('?'), u = decodeURIComponent(partes[0]).replace(/\.\./g, '');
  if (q.method === 'POST' && u === '/salvar') {
    const nome = (new URLSearchParams(partes[1] || '').get('nome') || '').replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!nome) { r.writeHead(400); return r.end(); }
    let corpo = ''; q.on('data', (d) => { corpo += d; }); q.on('end', () => {
      fs.mkdirSync(path.join(RAIZ, 'menu'), { recursive: true });
      const dados = nome.endsWith('.png') ? Buffer.from(corpo.replace(/^data:image\/png;base64,/, ''), 'base64') : corpo;
      fs.writeFileSync(path.join(RAIZ, 'menu', nome), dados); r.writeHead(200); r.end('ok');
    });
    return;
  }
  const f = path.join(RAIZ, u === '/' ? 'galeria.html' : u);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(fs.readFileSync(f));
}).listen(8774, () => console.log('http://localhost:8774/galeria.html'));

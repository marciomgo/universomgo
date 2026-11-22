// Servidor local da conferencia/edicao: serve o mapa e grava as correcoes do Marcio nos arquivos do parque.
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const regras = JSON.parse(fs.readFileSync(path.join(RAIZ, 'conteudo', 'combate-teste.json'), 'utf8'));
const SLUGS = regras.parques.map((p) => p.slug);
const tipos = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.js': 'text/javascript' };
const lerJson = (f, padrao) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : padrao);

function salvar(slug, ed) {
  const dir = path.join(RAIZ, 'arena', 'parques', slug);
  // copia de seguranca do que existia antes
  const hist = path.join(dir, 'edicoes-anteriores', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(hist, { recursive: true });
  ['zonas.json', 'liberar.json', 'caminhos-extra.json', 'opcoes.json', 'largada.json', 'perimetro.json', 'segura-editada.json', 'combate-editado.json'].forEach((n) => { const f = path.join(dir, n); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(hist, n)); });
  const grava = (n, o) => fs.writeFileSync(path.join(dir, n), JSON.stringify(o));
  grava('zonas.json', ed.zonas || []);
  grava('liberar.json', ed.liberar || []);
  grava('caminhos-extra.json', ed.caminhosExtra || []);
  const op = lerJson(path.join(dir, 'opcoes.json'), {});
  op.caminhosRemovidos = ed.caminhosRemovidos || [];
  op.ignorarZonasAuto = ed.ignorarZonasAuto || [];
  if (Array.isArray(ed.apagarNoPonto)) op.apagarNoPonto = ed.apagarNoPonto.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number');
  grava('opcoes.json', op);
  if (Array.isArray(ed.segura) && ed.segura.length) grava('segura-editada.json', ed.segura);
  if (ed.voltarVerdeAuto) { const f = path.join(dir, 'segura-editada.json'); if (fs.existsSync(f)) fs.unlinkSync(f); }
  if (ed.combate && Array.isArray(ed.combate.pontos)) grava('combate-editado.json', ed.combate);
  if (ed.voltarCombateAuto) { const f = path.join(dir, 'combate-editado.json'); if (fs.existsSync(f)) fs.unlinkSync(f); }
  if (Array.isArray(ed.perimetro) && ed.perimetro.length >= 3) grava('perimetro.json', ed.perimetro);
  if (ed.largada && typeof ed.largada.lat === 'number' && typeof ed.largada.lng === 'number') grava('largada.json', { lat: ed.largada.lat, lng: ed.largada.lng });
  const roda = (args) => execFileSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8', timeout: 280000 });
  const a = roda(['arena/gerar-arena.js', slug]);
  const b = roda(['build/gerar-teste-combate.js']);
  const linhas = (txt) => txt.split(/\r?\n/).join(' ').replace(/\s+/g, ' ').trim();
  const av = b.indexOf('AVISOS:');
  return { arena: linhas(a).slice(0, 700), avisos: av >= 0 ? linhas(b.slice(av)).slice(0, 600) : 'sem avisos' };
}

function escolherLado(slug, pt) { // grava o lado oficial (um ponto dentro dele) e gera de novo
  const dir = path.join(RAIZ, 'arena', 'parques', slug);
  const f = path.join(dir, 'opcoes.json'); const op = lerJson(f, {});
  const hist = path.join(dir, 'edicoes-anteriores', new Date().toISOString().replace(/[:.]/g, '-')); fs.mkdirSync(hist, { recursive: true }); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(hist, 'opcoes.json'));
  op.ladoOficial = { lng: pt.lng, lat: pt.lat }; fs.writeFileSync(f, JSON.stringify(op));
  const roda = (args) => execFileSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8', timeout: 280000 });
  const a = roda(['arena/gerar-arena.js', slug]); roda(['build/gerar-teste-combate.js']);
  return { ok: true, arena: a.split(String.fromCharCode(10)).filter((x) => x.indexOf('LADOS') === 0).join(' ') };
}

http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (q.method === 'POST' && u.startsWith('/lado/')) {
    const slug = u.slice(6);
    if (!SLUGS.includes(slug)) { r.writeHead(400); return r.end('parque invalido'); }
    let corpo = ''; q.on('data', (d) => { corpo += d; if (corpo.length > 1e5) q.destroy(); });
    q.on('end', () => { try { const pt = JSON.parse(corpo); if (typeof pt.lng !== 'number' || typeof pt.lat !== 'number') throw new Error('ponto invalido'); const res = escolherLado(slug, pt); r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(res)); } catch (e) { r.writeHead(500, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ ok: false, erro: String(e.message || e).slice(0, 500) })); } });
    return;
  }
  if (q.method === 'POST' && u.startsWith('/salvar/')) {
    const slug = u.slice(8);
    if (!SLUGS.includes(slug)) { r.writeHead(400); return r.end('parque invalido'); }
    let corpo = '';
    q.on('data', (d) => { corpo += d; if (corpo.length > 5e6) q.destroy(); });
    q.on('end', () => {
      try { const res = salvar(slug, JSON.parse(corpo)); r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(Object.assign({ ok: true }, res))); }
      catch (e) { r.writeHead(500, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ ok: false, erro: String(e.message || e).slice(0, 500) })); }
    });
    return;
  }
  const f = path.join(__dirname, u === '/' ? 'viewer.html' : u);
  if (!f.startsWith(__dirname) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  r.end(fs.readFileSync(f));
}).listen(8771, () => console.log('conferir/editar em http://localhost:8771/?p=parcao'));

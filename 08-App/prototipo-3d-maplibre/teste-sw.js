// Teste do sw-mgo.js SEM navegador: simula o service worker com armazéns de mentira e conferimos o roteamento.
// (O navegador de teste do Claude não registra service worker; o teste real é no celular em modo avião.)
const fs = require('fs');
const codigo = fs.readFileSync(__dirname + '/sw-mgo.js', 'utf8');

// ---- armazéns de mentira ----
const armazens = {};
function chave(req, ignoreSearch) { const u = new URL(typeof req === 'string' ? req : req.url, 'https://exemplo.github.io/sitemeuguiaoutdoor/sw-mgo.js'); if (ignoreSearch) u.search = ''; return u.href; }
function criarCache(nome) {
  armazens[nome] = armazens[nome] || new Map();
  const m = armazens[nome];
  return {
    async match(req, o) { const k = chave(req, o && o.ignoreSearch); for (const [kk, v] of m) { if (chave(kk, o && o.ignoreSearch) === k) return v.clone(); } return undefined; },
    async put(req, resp) { m.set(chave(req), resp.clone()); },
    async add(u) { const r = await fetch(u); m.set(chave(u), r.clone()); },
    async delete(req) { return m.delete(chave(req)); },
    async keys() { return [...m.keys()].map((u) => ({ url: u })); }
  };
}
const caches = {
  async open(n) { return criarCache(n); },
  async match(req, o) { for (const n in armazens) { const r = await criarCache(n).match(req, o); if (r) return r; } return undefined; }
};

// ---- ambiente do worker ----
let internet = true; const pedidosRede = [];
const ouvintes = {};
const self = { location: { origin: 'https://exemplo.github.io' }, skipWaiting() {}, clients: { claim() {} }, addEventListener(t, f) { ouvintes[t] = f; } };
async function fetchFalso(req) {
  const url = typeof req === 'string' ? req : req.url; pedidosRede.push(url);
  if (!internet) throw new TypeError('Failed to fetch');
  return new Response('rede:' + url, { status: 200 });
}
const fn = new Function('self', 'caches', 'fetch', 'Response', 'URL', 'setTimeout', codigo);
fn(self, caches, fetchFalso, Response, URL, setTimeout);

async function pedir(url, extra) {
  const req = Object.assign(new Request(url), {}); const ev = { request: extra && extra.navegar ? { url, method: 'GET', mode: 'navigate' } : { url, method: 'GET', mode: 'cors' } };
  let resp; ev.respondWith = (p) => { resp = p; }; ouvintes.fetch(ev); const r = await resp; return { status: r.status, texto: await r.text() };
}
let falhas = 0; const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' - ' + msg); if (!c) falhas++; };

(async () => {
  const PAG = 'https://exemplo.github.io/sitemeuguiaoutdoor/mapa3d.html', TILE = 'https://tiles.openfreemap.org/planet/2026/14/5863/9630.pbf', TJ = 'https://tiles.openfreemap.org/planet', IMG = 'https://exemplo.github.io/sitemeuguiaoutdoor/mineu-costas.png', LIB = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.1/maplibre-gl.js';
  // 1. com internet: página vem da rede e fica guardada
  let r = await pedir(PAG, { navegar: true }); ok(r.texto.startsWith('rede:'), 'página abre pela rede quando há internet');
  // 2. sem internet: a página guardada abre (mesmo com ?sala= na URL)
  internet = false; r = await pedir(PAG + '?sala=1234', { navegar: true }); ok(r.status === 200 && r.texto.startsWith('rede:'), 'sem internet a página guardada abre (ignora a parte ?sala=)');
  // 3. biblioteca e imagem: depois de guardadas, saem do cache
  internet = true; await pedir(LIB); await pedir(IMG); internet = false;
  r = await pedir(LIB); ok(r.status === 200, 'biblioteca do mapa guardada abre sem internet');
  r = await pedir(IMG); ok(r.status === 200, 'imagem do jogo guardada abre sem internet');
  // 4. mapa baixado: TileJSON e pedaço saem do cache; pedaço não baixado falha sem travar
  internet = true; await pedir(TJ); await pedir(TILE); internet = false;
  r = await pedir(TJ); ok(r.status === 200, 'TileJSON baixado abre sem internet');
  r = await pedir(TILE); ok(r.status === 200, 'pedaço do mapa baixado abre sem internet');
  r = await pedir('https://tiles.openfreemap.org/planet/2026/14/9999/9999.pbf'); ok(r.status === 504, 'pedaço NÃO baixado responde 504 (o mapa só fica vazio ali), sem travar');
  // 5. sem internet e página nunca guardada: mensagem em vez de tela de erro do navegador
  r = await pedir('https://exemplo.github.io/sitemeuguiaoutdoor/outra.html', { navegar: true }); ok(r.status === 503, 'página nunca baixada responde 503 com mensagem');
  // 6. modo de teste "finge offline" mesmo com internet: só usa o que está guardado e não toca na rede
  internet = true; await new Promise((res) => { ouvintes.message({ data: { t: 'offline-teste', v: true }, waitUntil: (p) => p.then(res) }); });
  pedidosRede.length = 0; r = await pedir(TILE); ok(r.status === 200 && pedidosRede.length === 0, 'modo offline de teste serve do cache sem usar a rede');
  r = await pedir('https://tiles.openfreemap.org/planet/2026/14/1/1.pbf'); ok(r.status === 504 && pedidosRede.length === 0, 'modo offline de teste não vai à rede nem pro que falta');
  await new Promise((res) => { ouvintes.message({ data: { t: 'offline-teste', v: false }, waitUntil: (p) => p.then(res) }); });
  r = await pedir(TILE); ok(r.status === 200, 'ao desligar o modo de teste volta ao normal');
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();

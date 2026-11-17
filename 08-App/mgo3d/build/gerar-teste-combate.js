// BUILD do teste de combate: junta ARENA (arena/parques/<slug>/arena.json) + CONTEUDO (conteudo/combate-teste.json) + MODELO do jogo
// (../prototipo-3d-maplibre/proto-modelo.html) e gera, em saida/, uma pagina por parque + a pagina de entrada. NINGUEM edita a saida a mao.
// Uso: node build/gerar-teste-combate.js
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'saida');
const MODELO = path.join(RAIZ, '..', 'prototipo-3d-maplibre', 'proto-modelo.html');
const regras = JSON.parse(fs.readFileSync(path.join(RAIZ, 'conteudo', 'combate-teste.json'), 'utf8'));
const avisos = [];

const R = 6371000, rad = Math.PI / 180;
const dist = (a, b) => { const dl = (b.lat - a.lat) * rad, dn = (b.lng - a.lng) * rad; return R * Math.sqrt(dl * dl + (dn * Math.cos(a.lat * rad)) ** 2); };
const em = (p, m, ang) => ({ lat: p.lat + (m * Math.cos(ang * rad)) / 111320, lng: p.lng + (m * Math.sin(ang * rad)) / (111320 * Math.cos(p.lat * rad)) });
const arred = (n) => Math.round(n * 1e7) / 1e7;

// ---- ferramentas de escolha ----
function distAteRota(p, rota) { // distancia (m) do ponto ate a linha da rota (largada -> bases)
  if (rota.length < 2) return dist(p, rota[0]);
  return turf.pointToLineDistance(turf.point([p.lng, p.lat]), turf.lineString(rota.map((q) => [q.lng, q.lat])), { units: 'meters' });
}
function espalhar(cands, n) { // escolhe n candidatos bem espalhados (o proximo e sempre o mais longe dos ja escolhidos)
  if (cands.length <= n) return cands.slice();
  const esc = [cands[0]];
  while (esc.length < n) {
    let melhor = null, md = -1;
    cands.forEach((c) => { if (esc.includes(c)) return; const d = Math.min(...esc.map((e) => dist(c, e))); if (d > md) { md = d; melhor = c; } });
    esc.push(melhor);
  }
  return esc;
}

function montarCombate(arena) {
  const L = arena.largada, B = regras.bases, M = regras.monstros, I = regras.itens;
  const segura = arena.segura ? turf.feature(arena.segura) : null;
  const naSegura = (p) => !segura || turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), segura);

  // 1) bases em sequencia: a 1a longe da largada, as outras sempre as mais proximas da anterior
  let raio = B.raioMaxDaLargadaM, rota = [];
  for (; raio <= 420; raio += 40) {
    const todos = arena.pontos.filter((p) => p.seguro !== false && dist(p, L) >= B.distMinDaLargadaM && dist(p, L) <= raio);
    rota = [];
    const primeira = todos.slice().sort((a, b) => Math.abs(dist(a, L) - B.alvoDaPrimeiraM) - Math.abs(dist(b, L) - B.alvoDaPrimeiraM))[0];
    if (!primeira) continue;
    rota.push(primeira); let atual = primeira;
    while (rota.length < B.quantidade) {
      const c = todos.filter((p) => rota.every((r) => dist(p, r) >= B.distMinEntreBasesM)).sort((a, b) => dist(a, atual) - dist(b, atual))[0];
      if (!c) break; rota.push(c); atual = c;
    }
    if (rota.length >= B.quantidade) break;
  }
  if (rota.length < B.quantidade) avisos.push(arena.slug + ': so achei ' + rota.length + ' bases (queria ' + B.quantidade + ')');
  if (raio > B.raioMaxDaLargadaM) avisos.push(arena.slug + ': precisei abrir o raio das bases para ' + raio + ' m');
  const linha = [L].concat(rota);
  const compr = Math.round(linha.slice(1).reduce((s, p, i) => s + dist(linha[i], p), 0));

  // 2) monstros: tentam o angulo/distancia pedidos e, se cairem fora da area segura, recuam
  const posicao = (base, m, ang) => {
    for (const f of [1, 0.75, 0.5]) for (let k = 0; k < 12; k++) { const p = em(base, m * f, ang + k * 30); if (naSegura(p)) return p; }
    avisos.push(arena.slug + ': monstro sem lugar seguro perto da base ' + base.codigo); return null;
  };
  const zumbis = [], chefoes = [];
  rota.forEach((b, i) => {
    const n = M.zumbisPorBase, ult = i === rota.length - 1;
    for (let k = 0; k < n; k++) { const p = posicao(b, M.zumbiDistDaBaseM, (360 / n) * k + i * 40 + 20); if (p) zumbis.push(p); }
    if (M.chefaoEmCadaBase) { const p = posicao(b, M.chefaoDistDaBaseM, 70 + i * 55); if (p) chefoes.push(Object.assign(p, { final: false })); }
    if (ult) { const p = posicao(b, M.chefaoFinalDistDaBaseM, 250); if (p) chefoes.push(Object.assign(p, { final: true })); }
  });

  // 3) itens: so os que ficam perto do percurso, bem espalhados
  const perto = (lista) => lista.filter((p) => distAteRota(p, linha) <= I.distMaxDaRotaM);
  const curas = espalhar(perto(arena.curas), I.curas);
  const pedras = espalhar(perto(arena.pedrasNormais), I.pedras);
  const bombas = espalhar(arena.bombas.filter((p) => distAteRota(p, linha) <= (I.distMaxBombasM || I.distMaxDaRotaM)), I.bombas);
  if (curas.length < 3) avisos.push(arena.slug + ': so ' + curas.length + ' curas perto do percurso');
  if (pedras.length < 3) avisos.push(arena.slug + ': so ' + pedras.length + ' pedras perto do percurso');
  if (bombas.length < 3) avisos.push(arena.slug + ': so ' + bombas.length + ' bombas perto do percurso');

  return {
    resumo: { parque: arena.slug, bases: rota.length, percurso_m: compr, zumbis: zumbis.length, chefoes: chefoes.length, curas: curas.length, pedras: pedras.length, bombas: bombas.length },
    dados: {
      slug: 'combate-' + arena.slug, nomeParque: arena.nomeExibicao,
      largada: L, perimetro: typeof arena.perimetro === 'string' ? JSON.parse(arena.perimetro) : arena.perimetro,
      pontos: rota.map((p, i) => ({ n: i + 1, lat: p.lat, lng: p.lng })),
      curas: curas.map((p) => ({ lat: p.lat, lng: p.lng })),
      pedras: pedras.map((p) => ({ lat: p.lat, lng: p.lng, esp: false })),
      bombas: bombas.map((p, i) => ({ lat: p.lat, lng: p.lng, e: I.emojisBomba[i % I.emojisBomba.length] })),
      chefoes: chefoes.map((c) => ({ lat: arred(c.lat), lng: arred(c.lng), final: c.final })),
      zumbis: zumbis.map((z) => ({ lat: arred(z.lat), lng: arred(z.lng) })),
      semEspecial: !regras.armas.pedraEspecial, celebraAoLimpar: !!regras.celebraAoLimpar, pesquisaUrl: regras.pesquisaUrl
    }
  };
}

// ---- gera as paginas ----
fs.mkdirSync(SAIDA, { recursive: true });
const modelo = fs.readFileSync(MODELO, 'utf8');
const fonteDinamica = fs.readFileSync(path.join(__dirname, 'combate-dinamico.js'), 'utf8'); // funcao que monta o combate no navegador (largada livre)
const resumos = [];
regras.parques.forEach((pq) => {
  const f = path.join(RAIZ, 'arena', 'parques', pq.slug, 'arena.json');
  if (!fs.existsSync(f)) { avisos.push(pq.slug + ': arena.json nao existe (rode arena/gerar-arena.js ' + pq.slug + ')'); return; }
  const arena = JSON.parse(fs.readFileSync(f, 'utf8')); arena.nomeExibicao = pq.nome;
  const { resumo, dados } = montarCombate(arena);
  // combate arrumado a mao no editor (arena/parques/<slug>/combate-editado.json): substitui o que o codigo montou
  const fe = path.join(RAIZ, 'arena', 'parques', pq.slug, 'combate-editado.json');
  let combateEditado = false;
  if (fs.existsSync(fe)) {
    const ce = JSON.parse(fs.readFileSync(fe, 'utf8')); combateEditado = true;
    const I = regras.itens;
    dados.pontos = (ce.pontos || []).map((p, i) => ({ n: i + 1, lat: p.lat, lng: p.lng }));
    dados.zumbis = (ce.zumbis || []).map((p) => ({ lat: p.lat, lng: p.lng }));
    dados.chefoes = (ce.chefoes || []).map((c) => ({ lat: c.lat, lng: c.lng, final: !!c.final }));
    dados.curas = (ce.curas || []).map((p) => ({ lat: p.lat, lng: p.lng }));
    dados.pedras = (ce.pedras || []).map((p) => ({ lat: p.lat, lng: p.lng, esp: false }));
    dados.bombas = (ce.bombas || []).map((p, i) => ({ lat: p.lat, lng: p.lng, e: p.e || I.emojisBomba[i % I.emojisBomba.length] }));
    const linhaE = [arena.largada].concat(dados.pontos);
    Object.assign(resumo, { editado: true, bases: dados.pontos.length, percurso_m: Math.round(linhaE.slice(1).reduce((s, p, i) => s + dist(linhaE[i], p), 0)), zumbis: dados.zumbis.length, chefoes: dados.chefoes.length, curas: dados.curas.length, pedras: dados.pedras.length, bombas: dados.bombas.length });
    const finais = dados.chefoes.filter((c) => c.final).length;
    if (finais !== 1) avisos.push(pq.slug + ': o combate editado tem ' + finais + ' chefao(oes) final(is) (o normal e 1)');
    if (!dados.pontos.length) avisos.push(pq.slug + ': o combate editado nao tem nenhuma base');
    if (arena.segura) {
      const seg = turf.feature(arena.segura);
      const todos = [].concat(dados.pontos, dados.zumbis, dados.chefoes, dados.curas, dados.pedras, dados.bombas);
      const fora = todos.filter((p) => !turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), seg)).length;
      if (fora) avisos.push(pq.slug + ': ' + fora + ' item(ns) do combate fora da area verde (vale o que voce decidiu)');
    }
  }
  // LARGADA LIVRE: a pagina nao leva percurso pronto; leva a arena (piscina de pontos/itens + area segura) e monta o combate onde a pessoa estiver.
  // Combate arrumado a mao (combate-editado.json) e um percurso FIXO e desliga a largada livre naquele parque.
  const dinamico = regras.largadaLivre !== false && !combateEditado;
  const dadosEditor = JSON.parse(JSON.stringify(dados)); // o editor mostra um exemplo montado a partir da largada padrao
  if (dinamico) {
    const cru = (l) => l.map((p) => ({ lat: p.lat, lng: p.lng }));
    let seg = null; if (arena.segura) { try { seg = turf.truncate(turf.simplify(turf.feature(arena.segura), { tolerance: 0.00002, highQuality: true }), { precision: 6 }).geometry; } catch (e) { seg = arena.segura; } }
    dados.dinamico = true;
    dados.arena = { pontos: cru(arena.pontos.filter((p) => p.seguro !== false)), curas: cru(arena.curas), pedras: cru(arena.pedrasNormais), bombas: cru(arena.bombas), segura: seg };
    dados.regrasDinamicas = { bases: regras.bases, monstros: regras.monstros, itens: regras.itens };
    dados.pontos = []; dados.zumbis = []; dados.chefoes = []; dados.curas = []; dados.pedras = []; dados.bombas = [];
  }
  resumo.largadaLivre = dinamico;
  const arq = 'combate-' + pq.slug + '.html', man = 'manifest-combate-' + pq.slug + '.json';
  fs.writeFileSync(path.join(SAIDA, arq), modelo.replace('/*DADOS*/', () => 'const DADOS = ' + JSON.stringify(dados) + ';').replace('/*COMBATE_DINAMICO*/', () => fonteDinamica).replace('__MANIFESTO__', man));
  fs.writeFileSync(path.join(SAIDA, man), JSON.stringify({ name: 'MGO · Combate · ' + pq.nome, short_name: 'MGO', start_url: './' + arq, scope: './', display: 'standalone', orientation: 'portrait', background_color: '#1f5a2c', theme_color: '#2f6b3a', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));
  resumos.push(Object.assign({ arquivo: arq }, resumo));
  // material para o visualizador de conferencia (satelite): o combate montado + a area segura, os caminhos e as zonas
  fs.mkdirSync(path.join(RAIZ, 'conferir', 'dados'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'conferir', 'dados', pq.slug + '.json'), JSON.stringify({ dados: dadosEditor, dinamico, combateEditado, arena: { terreno: arena.terreno, perimetroOriginal: arena.perimetroOriginal, seguraEditada: arena.seguraEditada, construcoes: arena.construcoes, agua: arena.agua, viasCarro: arena.viasCarro, viasServico: arena.viasServico, largada: arena.largada, segura: arena.segura, caminhos: arena.caminhos, caminhosIds: arena.caminhosIds, caminhosRemovidos: arena.caminhosRemovidos, caminhosExtra: arena.caminhosExtra, zonas: arena.zonas, zonasAuto: arena.zonasAuto, zonasAutoIgnoradas: arena.zonasAutoIgnoradas, zonasAutoLivres: arena.zonasAutoLivres, liberar: arena.liberar } }));
});

// ---- pagina de entrada: escolhe o parque ----
const botoes = regras.parques.map((pq) => '<a class="parque" href="combate-' + pq.slug + '.html">' + pq.nome + '</a>').join('\n    ');
fs.writeFileSync(path.join(SAIDA, 'combate.html'), `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>MGO · Combate</title><meta name="theme-color" content="#2f6b3a">
<style>
  :root{--verde:#1f5a2c;--verde2:#2f6b3a;--ouro:#ffd54f;--creme:#fff8e1;--tinta:#2b2110}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:var(--verde);color:#fff;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;padding:28px 18px 40px}
  img{height:150px;margin-bottom:6px;filter:drop-shadow(0 6px 6px rgba(0,0,0,.35))}
  h1{margin:4px 0 6px;font-size:30px;text-align:center}
  p{margin:0 0 20px;max-width:340px;text-align:center;line-height:1.4;color:#e3f0d8}
  .lista{display:flex;flex-direction:column;gap:12px;width:100%;max-width:340px}
  .parque{display:block;text-align:center;text-decoration:none;font-size:20px;font-weight:bold;padding:18px 16px;border-radius:999px;background:var(--ouro);color:var(--tinta);box-shadow:0 4px 0 #c99a00}
  .parque:active{transform:translateY(2px);box-shadow:0 2px 0 #c99a00}
  small{margin-top:22px;max-width:340px;text-align:center;color:#bcd8ae;line-height:1.4}
</style></head><body>
  <img src="mineu-comemora.png" alt="Mineu">
  <h1>Combate</h1>
  <p>Escolha o parque onde você está. Derrote os monstros de cada base e enfrente o chefão final.</p>
  <div class="lista">
    ${botoes}
  </div>
  <small>Dica: em casa, com internet, abra o parque e toque em “Baixar o parque” antes de sair. Use o celular na vertical e deixe a tela sempre acesa.</small>
</body></html>
`);

console.log(JSON.stringify(resumos, null, 1));
console.log(avisos.length ? '\nAVISOS:\n- ' + avisos.join('\n- ') : '\nsem avisos');
if (/COLOCAR-O-LINK/.test(regras.pesquisaUrl)) console.log('\nATENCAO: o link do Forms ainda e provisorio (conteudo/combate-teste.json -> pesquisaUrl).');

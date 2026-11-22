// Gera o prototipo "mapa 3D do MGO" (MapLibre GL), uma pagina por cenario: parcao e casa.
const fs = require('fs');
const R = 6371000, rad = Math.PI / 180;
const dist = (a, b) => { const dl = (b.lat - a.lat) * rad, dn = (b.lng - a.lng) * rad; return R * Math.sqrt(dl * dl + (dn * Math.cos(a.lat * rad)) ** 2); };
const em = (p, m, ang) => ({ lat: p.lat + (m * Math.cos(ang * rad)) / 111320, lng: p.lng + (m * Math.sin(ang * rad)) / (111320 * Math.cos(p.lat * rad)) });

function parcao() {
  const d = require('./dados/data-v2.json'); const L = d.largada;
  const dentro = (arr, max) => arr.filter((p) => dist(p, L) < max);
  return {
    largada: L, perimetro: typeof d.perimetro === "string" ? JSON.parse(d.perimetro) : d.perimetro,
    pontos: dentro(d.pontos, 130).slice(0, 14).map((p) => ({ n: p.codigo, lat: p.lat, lng: p.lng })),
    curas: dentro(d.curas, 200).slice(0, 5).map((p) => ({ lat: p.lat, lng: p.lng })),
    pedras: dentro(d.pedrasNormais, 200).slice(0, 8).map((p) => ({ lat: p.lat, lng: p.lng, esp: false }))
      .concat(dentro(d.pedrasEspeciais, 200).slice(0, 3).map((p) => ({ lat: p.lat, lng: p.lng, esp: true }))),
    bombas: dentro(d.bombas, 200).slice(0, 5).map((p, i) => ({ lat: p.lat, lng: p.lng, e: ['🍌', '🐝', '🐍', '💩', '🐶'][i % 5] })),
    chefoes: [{ lat: -30.0257, lng: -51.2001409, final: true }],
    zumbis: [[-30.02563, -51.20023], [-30.02577, -51.20005], [-30.02569, -51.20028]].map(([lat, lng]) => ({ lat, lng }))
  };
}

// Combate no Parcão: 5 bases em sequência (a 1ª longe da largada), zumbis em volta de cada uma e o chefão final na última.
// Nível 1: 2 zumbis por base. Nível 2: 3 zumbis por base + um chefão em cada base.
function combate(nivel) {
  const d = require('./dados/data-v2.json'); const L = d.largada;
  const todos = d.pontos.filter((p) => dist(p, L) < 130).slice(0, 14).filter((p) => dist(p, L) >= 55); // nada de base perto da largada (os monstros acordam a 35 m)
  const rota = [];
  let atual = todos.filter((p) => dist(p, L) >= 60).sort((a, b) => Math.abs(dist(a, L) - 80) - Math.abs(dist(b, L) - 80))[0];
  rota.push(atual);
  while (rota.length < 5) {
    const cand = todos.filter((p) => rota.every((r) => dist(p, r) >= 35)).sort((a, b) => dist(a, atual) - dist(b, atual))[0];
    if (!cand) break; rota.push(cand); atual = cand;
  }
  const zumbis = [], chefoes = [];
  rota.forEach((b, i) => {
    const n = nivel === 2 ? 3 : 2, ult = i === rota.length - 1;
    for (let k = 0; k < n; k++) zumbis.push(em(b, 8, (360 / n) * k + i * 40 + 20));
    if (nivel === 2) chefoes.push(Object.assign(em(b, 12, 70 + i * 55), { final: false }));
    if (ult) chefoes.push(Object.assign(em(b, nivel === 2 ? 20 : 10, 250), { final: true }));
  });
  return { largada: L, perimetro: typeof d.perimetro === 'string' ? JSON.parse(d.perimetro) : d.perimetro,
    pontos: rota.map((p, i) => ({ n: i + 1, lat: p.lat, lng: p.lng })), curas: [], pedras: [], bombas: [], chefoes, zumbis };
}

function casa() {
  const c = require('./dados/casa3.json'); const L = c.largada;
  const bases = c.pontos;
  const emojis = ['🍌', '🐝', '🐍', '🐶'];
  // bombas: no meio de cada trecho largada -> 1 -> 2 -> 3 -> chegada
  const rota = [L, ...bases];
  const bombas = rota.slice(1).map((b, i) => {
    const a = rota[i]; return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, e: emojis[i % 4] };
  });
  const zumbis = [], chefoes = [];
  bases.forEach((b, i) => {
    [20, 140, 260].forEach((ang) => zumbis.push(em(b, 8, ang + i * 35)));
    chefoes.push(Object.assign(em(b, 6, 80 + i * 50), { final: !!b.chegada }));
  });
  return {
    largada: L, perimetro: typeof c.perimetro === "string" ? JSON.parse(c.perimetro) : c.perimetro,
    pontos: bases.map((p) => ({ n: p.codigo, lat: p.lat, lng: p.lng })),
    curas: c.curas.map((p) => ({ lat: p.lat, lng: p.lng })),
    pedras: c.pedrasNormais.map((p) => ({ lat: p.lat, lng: p.lng, esp: false })).concat(c.pedrasEspeciais.map((p) => ({ lat: p.lat, lng: p.lng, esp: true }))),
    bombas, chefoes, zumbis
  };
}

function livre() {
  const c = require('./dados/casa3.json');
  return { largada: c.largada, pontos: [], curas: [], pedras: [], bombas: [], chefoes: [], zumbis: [], livre: true };
}

const NOMES = { 'mapa3d.html': 'MGO · Parcão', 'mapa3d-casa.html': 'MGO · Casa (teste)', 'mapa3d-livre.html': 'MGO · Livre', 'mapa3d-dupla.html': 'MGO · Dupla', 'mapa3d-combate-1.html': 'MGO · Combate 1', 'mapa3d-combate-2.html': 'MGO · Combate 2' };
function escreverManifest(arq) {
  const man = { name: NOMES[arq] || 'MGO', short_name: 'MGO', start_url: './' + arq, scope: './', display: 'standalone', orientation: 'portrait', background_color: '#1f5a2c', theme_color: '#2f6b3a',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] };
  fs.writeFileSync(__dirname + '/saida/manifest-' + arq.replace('.html', '') + '.json', JSON.stringify(man, null, 1));
}
const modelo = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
const { montarBlocos } = require('./montar-blocos.js');
const MODO_DA_PAGINA = { 'mapa3d-livre.html': 'livre' }; // as demais paginas sao 'legado' (sem blocos)
[['mapa3d.html', parcao()], ['mapa3d-casa.html', casa()], ['mapa3d-livre.html', livre()], ['mapa3d-combate-1.html', combate(1)], ['mapa3d-combate-2.html', combate(2)]].forEach(([arq, dados]) => {
  const pagina = modelo.replace('/*DADOS*/', () => 'const DADOS = ' + JSON.stringify(dados) + ';').replace('__MANIFESTO__', 'manifest-' + arq.replace('.html', '') + '.json');
  fs.writeFileSync(__dirname + '/saida/' + arq, montarBlocos(pagina, MODO_DA_PAGINA[arq] || 'legado', __dirname + '/saida'));
  escreverManifest(arq);
  console.log(arq, 'pontos', dados.pontos.length, 'zumbis', dados.zumbis.length, 'chefoes', dados.chefoes.length, 'bombas', dados.bombas.length);
});

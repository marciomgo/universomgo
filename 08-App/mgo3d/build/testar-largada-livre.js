// Teste: a largada livre funciona de qualquer ponto dentro do parque? Sorteia pontos de partida dentro do contorno e mede o resultado.
const fs = require('fs'), path = require('path'), turf = require('@turf/turf');
const gerar = require('./combate-dinamico.js');
const regras = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'conteudo', 'combate-teste.json'), 'utf8'));
let sem = 0;
const rnd = () => { sem = (sem * 16807 + 12345) % 2147483647; return sem / 2147483647; };
for (const pq of regras.parques) {
  sem = 4242;
  const a = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'arena', 'parques', pq.slug, 'arena.json'), 'utf8'));
  const A = { pontos: a.pontos.filter((p) => p.seguro !== false), curas: a.curas, pedras: a.pedrasNormais, bombas: a.bombas, segura: a.segura };
  const R = { bases: regras.bases, monstros: regras.monstros, itens: regras.itens };
  const par = turf.polygon([JSON.parse(a.perimetro)]); const [W, S, E, N] = turf.bbox(par);
  const N_TESTES = 300; let ok = 0, completo = 0, falhou = 0; const comp = [], tZ = [], nCur = [], nPed = [], nBom = [], dPrim = []; let foraSegura = 0, ms = 0;
  for (let i = 0; i < N_TESTES; i++) {
    let L; do { L = { lng: W + rnd() * (E - W), lat: S + rnd() * (N - S) }; } while (!turf.booleanPointInPolygon([L.lng, L.lat], par));
    const t0 = Date.now(); const c = gerar(L, A, R); ms += Date.now() - t0;
    if (!c || !c.pontos.length) { falhou++; continue; }
    ok++; if (c.pontos.length >= R.bases.quantidade) completo++;
    const linha = [L].concat(c.pontos); let m = 0; for (let k = 1; k < linha.length; k++) m += turf.distance([linha[k - 1].lng, linha[k - 1].lat], [linha[k].lng, linha[k].lat], { units: 'meters' });
    comp.push(m); tZ.push(c.zumbis.length + c.chefoes.length); nCur.push(c.curas.length); nPed.push(c.pedras.length); nBom.push(c.bombas.length);
    dPrim.push(turf.distance([L.lng, L.lat], [c.pontos[0].lng, c.pontos[0].lat], { units: 'meters' }));
    if (a.segura) { const seg = turf.feature(a.segura); [].concat(c.zumbis, c.chefoes).forEach((p) => { if (!turf.booleanPointInPolygon([p.lng, p.lat], seg)) foraSegura++; }); }
  }
  const med = (v) => v.length ? Math.round(v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)]) : '-';
  const mn = (v) => v.length ? Math.min(...v) : '-';
  console.log(pq.slug.padEnd(18), `partidas ${N_TESTES}: montou ${ok} (completas com ${R.bases.quantidade} bases: ${completo}), falhou ${falhou}`,
    `| percurso mediano ${med(comp)} m, 1a base a ${med(dPrim)} m | monstros med ${med(tZ)} (min ${mn(tZ)}) | curas med ${med(nCur)} (min ${mn(nCur)}), pedras med ${med(nPed)} (min ${mn(nPed)}), bombas med ${med(nBom)} (min ${mn(nBom)}) | monstros fora do verde: ${foraSegura} | ${Math.round(ms / N_TESTES)} ms/partida`);
}

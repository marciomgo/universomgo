// CAMADA 3 — ARENA. Gera, para UM parque, o "palco" do jogo: largada, pontos, curas, pedras, bombas, zonas proibidas e a area segura.
// Nao sabe nada de combate nem de missao: so diz ONDE as coisas podem ficar. O conteudo (conteudo/) decide o que usar.
// Uso: node gerar-arena.js <slug>        (le parques/<slug>/{rel,area,ent,zonas,largada}.json e grava parques/<slug>/arena.json)
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const slug = process.argv[2];
if (!slug) { console.error('uso: node gerar-arena.js <slug>'); process.exit(1); }
const dir = path.join(__dirname, 'parques', slug);
const ler = (n, padrao) => { const f = path.join(dir, n); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : padrao; };

const rel = ler('rel.json').elements[0];
const area = ler('area.json').elements;
const ent = ler('ent.json', { elements: [] }).elements;
const ZONAS = ler('zonas.json', []);                 // zonas PROIBIDAS do Marcio: {nome,lat,lng,r} (circulo) ou {nome,poligono:[[lng,lat],..]}
const LIBERAR = ler('liberar.json', []);             // areas que o Marcio LIBEROU (poligonos [[lng,lat],..]): cancelam proibicoes automaticas do mapa
const SEGURA_EDITADA = ler('segura-editada.json', null); // area VERDE desenhada/ajustada a mao (coordenadas de MultiPolygon [[anel,buraco..],..]); quando existe, ela manda no lugar da automatica
const CAM_EXTRA = ler('caminhos-extra.json', []);    // trilhas desenhadas por ele (linhas [[lng,lat],..])
// opcoes.json (opcional, por parque): usarTodasAsPartes (usa todos os pedacos da area, nao so o maior), areaMinimaParteM2, modoPontos ('caminho' = perto de trilhas; 'area' = parque de gramado, em qualquer lugar da area segura)
const OP = Object.assign({ usarTodasAsPartes: false, areaMinimaParteM2: 800, modoPontos: 'caminho', distMaxCaminhoM: 10, caminhosRemovidos: [], ignorarZonasAuto: [] }, ler('opcoes.json', {}));
const LARGADA_FIXA = ler('largada.json', null);
const RT = JSON.parse(fs.readFileSync(path.join(__dirname, 'regras-terreno.json'), 'utf8')); // regras de terreno (dados)

const coords = (g) => g.map((p) => [p.lon, p.lat]);
const igual = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const dist = (a, b) => turf.distance(a, b, { units: 'meters' });
const arred = (n) => Math.round(n * 1e7) / 1e7;
const fechar = (r) => (igual(r[0], r[r.length - 1]) ? r : r.concat([r[0]]));

// ---- contorno: um caminho fechado (way) ou varios pedacos de uma relacao, costurados ----
function costurar(pedacos) {
  const aneis = []; const pool = pedacos.map((w) => w.slice());
  while (pool.length) {
    let cur = pool.shift(); let mudou = true;
    while (mudou && !igual(cur[0], cur[cur.length - 1])) {
      mudou = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        if (igual(cur[cur.length - 1], w[0])) { cur = cur.concat(w.slice(1)); pool.splice(i, 1); mudou = true; break; }
        if (igual(cur[cur.length - 1], w[w.length - 1])) { cur = cur.concat(w.slice().reverse().slice(1)); pool.splice(i, 1); mudou = true; break; }
        if (igual(cur[0], w[w.length - 1])) { cur = w.concat(cur.slice(1)); pool.splice(i, 1); mudou = true; break; }
        if (igual(cur[0], w[0])) { cur = w.slice().reverse().concat(cur.slice(1)); pool.splice(i, 1); mudou = true; break; }
      }
    }
    if (!igual(cur[0], cur[cur.length - 1])) cur.push(cur[0]);
    if (cur.length >= 4) aneis.push(cur);
  }
  return aneis;
}
let aneis;
if (rel.type === 'way') aneis = costurar([coords(rel.geometry)]);
else aneis = costurar(rel.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => coords(m.geometry)));
if (!aneis.length) { console.error('contorno vazio'); process.exit(1); }
aneis.sort((a, b) => turf.area(turf.polygon([b])) - turf.area(turf.polygon([a])));
const PARTE_MINIMA_M2 = 2000; // partes menores que isso (0,2 ha) sao ignoradas
const partesDoParque = aneis.filter((r, i) => i === 0 || turf.area(turf.polygon([r])) >= PARTE_MINIMA_M2);
if (aneis.length > 1) console.log('contorno com ' + aneis.length + ' partes no OpenStreetMap; usando ' + partesDoParque.length + ' (' + partesDoParque.map((r) => Math.round(turf.area(turf.polygon([r])) / 100) / 100 + ' ha').join(' + ') + ')');
const anelOriginalOSM = aneis[0]; // o contorno como o OpenStreetMap o tem (para o editor comparar com o seu)
const PERIMETRO_EDITADO = ler('perimetro.json', null); // contorno ajustado a mao pelo Marcio (substitui o do OpenStreetMap)
const anel = PERIMETRO_EDITADO ? fechar(PERIMETRO_EDITADO) : aneis[0];
const extrasDoParque = PERIMETRO_EDITADO ? [] : partesDoParque.slice(1); // o contorno que voce desenha no editor e um anel so; sem ele, vale o parque inteiro (todas as partes)
if (extrasDoParque.length) OP.usarTodasAsPartes = true; // parque com varias partes: a area segura tem que cobrir todas, nao so a maior
const parque = extrasDoParque.length ? turf.multiPolygon([[anel]].concat(extrasDoParque.map((r) => [r]))) : turf.polygon([anel]);

// ---- zonas proibidas: as do Marcio (satelite) + as que o mapa mostra (parquinhos e quadras) ----
const poligonoDaZona = (z) => (z.poligono ? turf.polygon([fechar(z.poligono)]) : turf.circle([z.lng, z.lat], z.r, { units: 'meters', steps: 48 }));
const zonaManuais = ZONAS.map(poligonoDaZona);
const zonaPoligonos = zonaManuais.slice();
const zonasAuto = [], zonasAutoIgnoradas = [], zonasAutoLivres = [];
area.forEach((e) => {
  const t = e.tags || {}; if (!e.geometry) return;
  if (!['playground', 'pitch'].includes(t.leisure)) return;
  const regraZ = (RT.zonasAuto && RT.zonasAuto[t.leisure]) || { bloquear: true, buffer_m: 2 };
  const c = coords(e.geometry); if (!(c.length > 3 && igual(c[0], c[c.length - 1]))) return;
  const poli = turf.polygon([c]);
  if (!turf.booleanIntersects(poli, parque)) return;
  const ct = turf.centroid(poli).geometry.coordinates;
  const buf = turf.buffer(poli, regraZ.buffer_m, { units: 'meters' }); // a forma que o mapa ja tem, com 2 m de folga para a margem de erro do GPS
  const anelBuf = buf && buf.geometry.type === 'Polygon' ? buf.geometry.coordinates[0] : c;
  const za = { nome: (t.leisure === 'playground' ? 'Parquinho' : 'Quadra') + (t.name ? ' ' + t.name : ''), lat: arred(ct[1]), lng: arred(ct[0]), tipo: t.leisure, poligono: anelBuf.map((q) => [arred(q[0]), arred(q[1])]) };
  if (regraZ.bloquear === false) { zonasAutoLivres.push(za); return; } // tipo que a regra libera (ex.: pracinha): so aparece cinza no editor, nao bloqueia
  if (OP.ignorarZonasAuto.some((q) => Math.abs(q[0] - za.lat) < 1e-6 && Math.abs(q[1] - za.lng) < 1e-6)) { zonasAutoIgnoradas.push(za); return; } // o Marcio mandou ignorar
  zonasAuto.push(za);
  zonaPoligonos.push(buf);
});

// ---- area permitida = parque - predios - agua - ruas de carro - zonas ----
const bloqueios = [];
const vistaConstrucoes = [], vistaAgua = [], vistaViasCarro = [], vistaViasServico = []; // so para o editor desenhar o que o mapa ja tem
const rr = (c) => c.map((q) => [arred(q[0]), arred(q[1])]);
area.forEach((e) => {
  const t = e.tags || {}; if (!e.geometry) return;
  const c = coords(e.geometry);
  const fechado = c.length > 3 && igual(c[0], c[c.length - 1]);
  if (t.building && fechado) vistaConstrucoes.push(rr(c));
  else if ((t.natural === 'water' || t.leisure === 'swimming_pool') && fechado) vistaAgua.push(rr(c));
  else if (t.highway === 'service') vistaViasServico.push(rr(c));
  else if (t.highway && ['secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'primary', 'trunk', 'primary_link', 'trunk_link', 'unclassified'].includes(t.highway)) vistaViasCarro.push(rr(c));
  if (t.building && fechado) bloqueios.push(turf.buffer(turf.polygon([c]), 2, { units: 'meters' }));
  else if ((t.natural === 'water' || t.leisure === 'swimming_pool') && fechado) bloqueios.push(turf.buffer(turf.polygon([c]), 5, { units: 'meters' }));
  else if (t.highway && ['secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'primary', 'trunk', 'primary_link', 'trunk_link', 'unclassified'].includes(t.highway)) bloqueios.push(turf.buffer(turf.lineString(c), 8, { units: 'meters' }));
  else if (t.highway === 'service') bloqueios.push(turf.buffer(turf.lineString(c), 4, { units: 'meters' }));
});
// ---- TERRENO (regras em regras-terreno.json): agua, mata densa, areas restritas, cercas, sinais que liberam ----
const casa = (tags, cond) => Object.keys(cond).some((k) => k.charAt(0) !== '_' && k !== 'buffer_m' && k !== 'corredor_da_trilha_m' && k !== 'area_fechada_max_fracao_do_parque' && tags[k] !== undefined && (cond[k] === '*' || (Array.isArray(cond[k]) ? cond[k].indexOf(tags[k]) >= 0 : cond[k] === tags[k])));
const fechadoC = (c) => c.length > 3 && igual(c[0], c[c.length - 1]);
const viz = { agua: [], aguaLinhas: [], mata: [], mataFechada: [], restrito: [], barreiras: [], libera: [] };
const bboxSeCruza = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
const areaParque = turf.area(parque);
const densos = [];
area.forEach((e) => {
  const tg = e.tags || {}; if (!e.geometry) return;
  const c = coords(e.geometry);
  if (fechadoC(c)) {
    let poli; try { poli = turf.polygon([c]); } catch (er) { return; }
    if (!turf.booleanIntersects(poli, parque)) return;
    if (casa(tg, RT.agua.poligonos)) { bloqueios.push(turf.buffer(poli, RT.agua.buffer_m, { units: 'meters' })); viz.agua.push(rr(c)); }
    else if (casa(tg, RT.mataDensa)) densos.push(poli);
    else if (casa(tg, RT.restrito) && tg.leisure !== 'park') { bloqueios.push(turf.buffer(poli, RT.restrito.buffer_m, { units: 'meters' })); viz.restrito.push(rr(c)); }
    else if (tg.barrier && RT.barreiras.barrier.indexOf(tg.barrier) >= 0 && !tg.leisure && !tg.landuse) {
      if (turf.area(poli) < areaParque * RT.barreiras.area_fechada_max_fracao_do_parque) { bloqueios.push(turf.buffer(poli, RT.barreiras.buffer_m, { units: 'meters' })); viz.restrito.push(rr(c)); }
      else { bloqueios.push(turf.buffer(turf.lineString(c), RT.barreiras.buffer_m, { units: 'meters' })); viz.barreiras.push(rr(c)); }
    }
  } else if (c.length >= 2) {
    if (tg.waterway && RT.aguaLinhas.waterway.indexOf(tg.waterway) >= 0) { bloqueios.push(turf.buffer(turf.lineString(c), RT.aguaLinhas.buffer_m, { units: 'meters' })); viz.aguaLinhas.push(rr(c)); }
    else if (tg.barrier && RT.barreiras.barrier.indexOf(tg.barrier) >= 0) { bloqueios.push(turf.buffer(turf.lineString(c), RT.barreiras.buffer_m, { units: 'meters' })); viz.barreiras.push(rr(c)); }
  }
});
// sinais que liberam a mata (churrasqueira, piquenique, abrigo, banco)
const discosLibera = [];
ent.forEach((x) => {
  const tg = x.tags || {};
  RT.libera.sinais.forEach((sn) => { const k = Object.keys(sn).filter((q) => q !== 'raio_m')[0]; if (tg[k] === sn[k]) { discosLibera.push(turf.circle([x.lon, x.lat], sn.raio_m, { units: 'meters', steps: 24 })); viz.libera.push({ lat: arred(x.lat), lng: arred(x.lon), r: sn.raio_m, tipo: sn[k] }); } });
});
// trilhas (as do mapa, menos as que voce tirou, mais as que voce desenhou): mata densa so vale em volta delas
const trilhasLinhas = [];
area.forEach((e) => {
  const tg = e.tags || {}; if (!e.geometry || ['footway', 'path', 'pedestrian', 'cycleway'].indexOf(tg.highway) < 0) return;
  if (tg.footway === 'crossing' || tg.access === 'private' || tg.indoor || OP.caminhosRemovidos.indexOf(e.id) >= 0) return;
  trilhasLinhas.push(turf.lineString(coords(e.geometry)));
});
CAM_EXTRA.forEach((c) => trilhasLinhas.push(turf.lineString(c)));
let densoEfetivo = [];
// metros de trilha que realmente atravessam o poligono (amostra a cada 5 m; trilha so encostando na borda nao conta)
function trilhaDentro(P) {
  const bp = turf.bbox(P); let total = 0;
  trilhasLinhas.forEach((l) => {
    if (!bboxSeCruza(turf.bbox(l), bp)) return;
    const L2 = turf.length(l, { units: 'meters' }); const n = Math.max(1, Math.floor(L2 / 5));
    for (let k = 0; k <= n; k++) { const p = turf.along(l, Math.min(L2, k * 5), { units: 'meters' }); if (turf.booleanPointInPolygon(p, P)) total += 5; }
  });
  return total;
}
let nMataFechada = 0, nMataComTrilha = 0;
densos.forEach((P) => {
  const comTrilha = trilhaDentro(P) >= RT.mataDensa.trilha_minima_dentro_m;
  let eff = P; const bp = turf.bbox(P);
  if (comTrilha) {
    // mata com trilha: so vale o corredor em volta da trilha; e os sinais (churrasqueira, banco...) abrem circulos dentro dela
    nMataComTrilha++;
    trilhasLinhas.forEach((l) => { if (!eff || !bboxSeCruza(turf.bbox(l), bp)) return; try { eff = turf.difference(turf.featureCollection([eff, turf.buffer(l, RT.mataDensa.corredor_da_trilha_m, { units: 'meters' })])); } catch (er) { } });
    discosLibera.forEach((dk) => { if (!eff) return; try { eff = turf.difference(turf.featureCollection([eff, dk])); } catch (er) { } });
  } else nMataFechada++; // mata FECHADA (sem trilha nenhuma): proibida inteira, prioridade total — nada a reabre
  if (eff) { try { eff = turf.intersect(turf.featureCollection([eff, parque])); } catch (er) { } }
  if (eff) { densoEfetivo.push(eff); (comTrilha ? viz.mata : viz.mataFechada).push(turf.truncate(eff, { precision: 7 }).geometry); }
});
zonaPoligonos.forEach((z) => bloqueios.push(z));
let permitida = parque;
bloqueios.forEach((b) => { try { const d = turf.difference(turf.featureCollection([permitida, b])); if (d) permitida = d; } catch (e) { } });
// areas liberadas pelo Marcio voltam a valer; as zonas proibidas dele continuam mandando por cima
LIBERAR.forEach((l) => { try { const lp = turf.intersect(turf.featureCollection([turf.polygon([fechar(l)]), parque])); if (lp) { const u = turf.union(turf.featureCollection([permitida, lp])); if (u) permitida = u; } } catch (e) { } });
if (LIBERAR.length) zonaManuais.forEach((b) => { try { const d = turf.difference(turf.featureCollection([permitida, b])); if (d) permitida = d; } catch (e) { } });
const pedacos = permitida.geometry.type === 'MultiPolygon' ? permitida.geometry.coordinates.map((c) => turf.polygon(c)) : [permitida];
pedacos.sort((a, b) => turf.area(b) - turf.area(a));
const grandes = pedacos.filter((p) => turf.area(p) >= OP.areaMinimaParteM2);
const principal = (OP.usarTodasAsPartes && grandes.length > 1) ? turf.multiPolygon(grandes.map((p) => p.geometry.coordinates)) : pedacos[0];
// MARGENS (regras-terreno.json -> margens): a folga de cada obstaculo (predio, quadra, agua...) ja esta na propria regra (buffer_m, 2 m).
// O recuo que sobra aqui vale SO para a borda do parque (erro do GPS). Antes o recuo de 12 m/6 m era aplicado tambem em volta de cada obstaculo.
const MG = RT.margens;
const recuoBorda = (m) => { try { const mi = turf.buffer(parque, -m, { units: 'meters' }); return mi ? turf.intersect(turf.featureCollection([principal, mi])) : principal; } catch (e) { return principal; } };
let interior = recuoBorda(MG.borda_itens_m) || principal;
let seguroPoli = recuoBorda(MG.borda_area_segura_m); // area segura para bases e monstros (cada monstro ainda e conferido dentro dela)

densoEfetivo.forEach((d) => {
  try { if (seguroPoli) { const x = turf.difference(turf.featureCollection([seguroPoli, d])); if (x) seguroPoli = x; } } catch (er) { }
  try { const y = turf.difference(turf.featureCollection([interior, d])); if (y) interior = y; } catch (er) { }
});
// ---- area verde editada a mao: vira a area segura final (as zonas proibidas desenhadas por ele continuam cortando); o contorno do jogo cresce para conter o verde ----
let seguraEditada = false, anelFinal = anel;
if (SEGURA_EDITADA && SEGURA_EDITADA.length) {
  seguraEditada = true;
  seguroPoli = turf.multiPolygon(SEGURA_EDITADA);
  zonaManuais.forEach((z) => { try { const d = turf.difference(turf.featureCollection([seguroPoli, z])); if (d) seguroPoli = d; } catch (e) { } });
  interior = seguroPoli;
  try {
    const u = turf.union(turf.featureCollection([parque, seguroPoli]));
    const partes = u.geometry.type === 'MultiPolygon' ? u.geometry.coordinates.map((c) => turf.polygon(c)) : [u];
    partes.sort((a, b) => turf.area(b) - turf.area(a));
    anelFinal = partes[0].geometry.coordinates[0];
    if (partes.length > 1) console.log('aviso: o verde editado tem partes separadas do contorno amarelo; o contorno do jogo usa so a maior juncao');
  } catch (e) { console.log('aviso: nao consegui juntar o verde ao contorno'); }
}

// ---- caminhos de pedestre (guia): amostras a cada ~3 m dentro da area ----
const caminhos = [], caminhosIds = [], caminhosRemovidos = [], amostras = [];
function addCaminho(c, id) {
  caminhos.push(c); caminhosIds.push(id);
  for (let i = 0; i < c.length - 1; i++) {
    const seg = turf.lineString([c[i], c[i + 1]]);
    const len = turf.length(seg, { units: 'meters' });
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= n; k++) {
      const p = turf.along(seg, (len * k) / n, { units: 'meters' });
      if (turf.booleanPointInPolygon(p, interior)) amostras.push(p);
    }
  }
}
area.forEach((e) => {
  const t = e.tags || {};
  if (!e.geometry || !['footway', 'path', 'pedestrian', 'cycleway'].includes(t.highway)) return;
  if (t.footway === 'crossing' || t.access === 'private' || t.indoor) return;
  const c = coords(e.geometry);
  if (OP.caminhosRemovidos.includes(e.id)) { caminhosRemovidos.push({ id: e.id, c: c.map((q) => [arred(q[0]), arred(q[1])]) }); return; } // o Marcio mandou tirar
  addCaminho(c, e.id);
});
CAM_EXTRA.forEach((c) => addCaminho(c, null)); // trilhas que o Marcio desenhou
if (amostras.length < 50) { console.error('poucos caminhos de pedestre dentro do parque (' + amostras.length + '): confira o desenho no OpenStreetMap'); process.exit(1); }
const amostrasFC = turf.featureCollection(amostras);
const distCaminho = (p) => dist(p, turf.nearestPoint(p, amostrasFC));

let semente = 777123; // mesma semente sempre: mesmo parque, mesmo resultado
const aleatorio = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
function pontoNaArea(poligono, tentativas = 400) { // ponto sorteado dentro de uma area (usado nos parques de gramado)
  const [minX, minY, maxX, maxY] = turf.bbox(poligono);
  for (let i = 0; i < tentativas; i++) { const p = turf.point([minX + aleatorio() * (maxX - minX), minY + aleatorio() * (maxY - minY)]); if (turf.booleanPointInPolygon(p, poligono)) return p; }
  return null;
}
const EM_AREA = OP.modoPontos === 'area';

// ---- largada: em cima de um caminho, perto de banheiro/bebedouro (ou entrada), >= 15 m de qualquer zona ----
const pontosDe = (f) => ent.filter(f).map((x) => turf.point([x.lon, x.lat]));
const banheiros = pontosDe((x) => x.tags && x.tags.amenity === 'toilets');
const aguas = pontosDe((x) => x.tags && x.tags.amenity === 'drinking_water');
const entradas = pontosDe((x) => x.tags && x.tags.entrance);
const ref = banheiros.concat(aguas).length ? banheiros.concat(aguas) : (entradas.length ? entradas : [turf.centroid(principal)]);
const distZona = (p) => { // distancia (m) ate a zona mais proxima; negativa = dentro
  const ds = [999];
  ZONAS.forEach((z, i) => ds.push(z.poligono ? turf.pointToPolygonDistance(p, zonaManuais[i], { units: 'meters' }) : dist(p, turf.point([z.lng, z.lat])) - z.r));
  zonasAuto.forEach((z) => { try { ds.push(turf.pointToPolygonDistance(p, turf.polygon([z.poligono]), { units: 'meters' })); } catch (e) { ds.push(dist(p, turf.point([z.lng, z.lat])) - 18); } });
  return Math.min(...ds);
};
let largada = null, melhor = Infinity;
amostras.forEach((p) => {
  if (distZona(p) < 15) return;
  if (!seguroPoli || !turf.booleanPointInPolygon(p, seguroPoli)) return;
  const score = Math.min(...ref.map((b) => dist(p, b)));
  if (score < melhor) { melhor = score; largada = p; }
});
if (LARGADA_FIXA) largada = turf.point([LARGADA_FIXA.lng, LARGADA_FIXA.lat]);
if (!largada) { console.error('nao achei lugar seguro para a largada'); process.exit(1); }

// ---- pontos: perto de caminhos (<= 8 m), em area segura p/ monstros, >= 10 m entre si, >= 25 m da largada ----
const ESPACO_PONTOS_M = 10, alvoPontos = 70;
const pontos = []; const inseguros = new Set(); let falhas = 0;
while (pontos.length < alvoPontos && falhas < 60000) {
  const base = amostras[Math.floor(aleatorio() * amostras.length)];
  const p = EM_AREA ? pontoNaArea(seguroPoli) : turf.destination(base, aleatorio() * 8, aleatorio() * 360, { units: 'meters' });
  if (!p) { falhas++; continue; }
  if (!seguroPoli || !turf.booleanPointInPolygon(p, seguroPoli)) { falhas++; continue; }
  if (dist(p, largada) < 25 || pontos.some((q) => dist(p, q) < ESPACO_PONTOS_M)) { falhas++; continue; }
  pontos.push(p);
}
falhas = 0;
while (pontos.length < alvoPontos && falhas < 40000) {
  const base = amostras[Math.floor(aleatorio() * amostras.length)];
  const p = EM_AREA ? pontoNaArea(interior) : turf.destination(base, aleatorio() * 8, aleatorio() * 360, { units: 'meters' });
  if (!p) { falhas++; continue; }
  if (!turf.booleanPointInPolygon(p, interior)) { falhas++; continue; }
  if (dist(p, largada) < 25 || pontos.some((q) => dist(p, q) < ESPACO_PONTOS_M)) { falhas++; continue; }
  pontos.push(p); inseguros.add(p);
}

// ---- cobertura: curas (<= 55 m dos pontos), pedras normais (<= 55 m), especiais (<= 80 m) ----
function cobrir(ocupados, raioMax, maxItens, espaco) {
  const itens = [];
  while (itens.length < maxItens) {
    let pior = null, piorD = 0;
    pontos.forEach((p) => { const d = itens.length ? Math.min(...itens.map((c) => dist(p, c))) : 9999; if (d > piorD) { piorD = d; pior = p; } });
    if (!pior || piorD <= raioMax) break;
    let novo = null;
    for (let t = 0; t < 600 && !novo; t++) {
      const cand = turf.destination(pior, 8 + aleatorio() * 22, aleatorio() * 360, { units: 'meters' });
      if (turf.booleanPointInPolygon(cand, interior) && (EM_AREA || distCaminho(cand) <= OP.distMaxCaminhoM)
        && !itens.some((c) => dist(c, cand) < espaco) && !ocupados.some((c) => dist(c, cand) < 6)) novo = cand;
    }
    if (!novo) break;
    itens.push(novo);
  }
  return itens;
}
const ocupados = pontos.slice();
const curas = cobrir(ocupados, 55, 24, 35); curas.forEach((c) => ocupados.push(c));
const pedrasNormais = cobrir(ocupados, 55, 26, 30); pedrasNormais.forEach((c) => ocupados.push(c));
const pedrasEspeciais = cobrir(ocupados, 80, 16, 40); pedrasEspeciais.forEach((c) => ocupados.push(c));

// ---- bombas: SO em cima de caminho, >= 25 m da largada, >= 10 m de pontos/itens, >= 30 m entre si ----
const bombas = []; let f2 = 0;
while (bombas.length < 16 && f2 < 40000) {
  const p = EM_AREA ? pontoNaArea(interior) : amostras[Math.floor(aleatorio() * amostras.length)]; // em parque de gramado a bomba tambem pode ficar fora de trilha
  if (!p) { f2++; continue; }
  if (dist(p, largada) < 25 || bombas.some((q) => dist(p, q) < 30) || ocupados.some((q) => dist(p, q) < 10)) { f2++; continue; }
  bombas.push(p);
}

const ll = (p) => ({ lat: arred(p.geometry.coordinates[1]), lng: arred(p.geometry.coordinates[0]) });
const cobMed = (lista) => { if (!lista.length) return null; const ds = pontos.map((p) => Math.round(Math.min(...lista.map((c) => dist(p, c))))); return { mediana: ds.slice().sort((a, b) => a - b)[Math.floor(ds.length / 2)], maximo: Math.max(...ds) }; };
const seguraGeo = seguroPoli ? turf.truncate(turf.simplify(seguroPoli, { tolerance: 0.00001, highQuality: true }), { precision: 7 }).geometry : null;

// o editor mostra so o que fica dentro ou perto (30 m) do parque: a gente baixa um retangulo maior que o parque e o resto da cidade so atrapalha a vista
const parqueVis = turf.buffer(extrasDoParque.length ? parque : turf.polygon([anelFinal]), 30, { units: 'meters' });
const perto = (g2) => { try { return turf.booleanIntersects(g2, parqueVis); } catch (e) { return true; } };
const vPoly = (arr) => arr.filter((c) => perto(turf.polygon([c])));
function recortar(c) { // pedacos de uma linha que ficam dentro da area de exibicao (as linhas compridas que so encostam nela nao aparecem inteiras)
  try {
    const l = turf.lineString(c);
    if (turf.booleanWithin(l, parqueVis)) return [c];
    if (!turf.booleanIntersects(l, parqueVis)) return [];
    const partes = turf.lineSplit(l, turf.polygonToLine(parqueVis));
    const fs2 = (partes.features && partes.features.length) ? partes.features : [l];
    return fs2.filter((f) => { const L2 = turf.length(f, { units: 'meters' }); const mid = turf.along(f, L2 / 2, { units: 'meters' }); return turf.booleanPointInPolygon(mid, parqueVis); }).map((f) => f.geometry.coordinates);
  } catch (e) { return perto(turf.lineString(c)) ? [c] : []; }
}
const vLin = (arr) => [].concat(...arr.map((c) => recortar(c)));
const camRec = []; caminhos.forEach((c, i) => recortar(c).forEach((p) => camRec.push({ c: p, id: caminhosIds[i] })));
const saida = {
  slug,
  nome: (rel.tags && rel.tags.name) || slug,
  largada: ll(largada),
  perimetro: JSON.stringify(anelFinal.map((c) => [arred(c[0]), arred(c[1])])), perimetroExtra: JSON.stringify(extrasDoParque.map((r) => r.map((c) => [arred(c[0]), arred(c[1])]))), perimetroOriginal: JSON.stringify(anelOriginalOSM.map((c) => [arred(c[0]), arred(c[1])])), seguraEditada,
  pontos: pontos.map((p, i) => Object.assign({ codigo: i + 1, distLargada: Math.round(dist(p, largada)), distCaminho: Math.round(distCaminho(p)), seguro: !inseguros.has(p) }, ll(p))),
  curas: curas.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  pedrasNormais: pedrasNormais.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  pedrasEspeciais: pedrasEspeciais.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  bombas: bombas.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  terreno: { agua: vPoly(viz.agua), aguaLinhas: vLin(viz.aguaLinhas), mata: viz.mata, mataFechada: viz.mataFechada, restrito: vPoly(viz.restrito), barreiras: vLin(viz.barreiras), libera: viz.libera },
  construcoes: vPoly(vistaConstrucoes), agua: vPoly(vistaAgua), viasCarro: vLin(vistaViasCarro), viasServico: vLin(vistaViasServico),
  zonas: ZONAS, zonasAuto, zonasAutoIgnoradas, zonasAutoLivres, liberar: LIBERAR, caminhosExtra: CAM_EXTRA, caminhosRemovidos: [].concat(...caminhosRemovidos.map((o) => recortar(o.c).map((p) => ({ id: o.id, c: p.map((q) => [arred(q[0]), arred(q[1])]) })))),
  segura: seguraGeo,
  caminhos: camRec.map((o) => o.c.map((q) => [arred(q[0]), arred(q[1])])), caminhosIds: camRec.map((o) => o.id),
  extras: banheiros.map((b) => Object.assign({ cor: '#ff00ff' }, ll(b))).concat(aguas.map((b) => Object.assign({ cor: '#00bcd4' }, ll(b)))),
  legenda: 'azul=pontos (n) · vermelho=cura · cinza/amarelo=pedras · preto=bomba (so caminho) · verde L=largada · rosa=banheiro · azul claro=bebedouro · ciano=caminhos · circulo vermelho=zona proibida'
};
fs.writeFileSync(path.join(dir, 'arena.json'), JSON.stringify(saida));
console.log(JSON.stringify({
  parque: slug, areaParque_m2: Math.round(turf.area(parque)), areaPermitida_m2: Math.round(turf.area(principal)), areaSegura_m2: seguroPoli ? Math.round(turf.area(seguroPoli)) : 0,
  terreno: { mataFechada: nMataFechada, mataComTrilha: nMataComTrilha, agua: viz.agua.length, aguaLinhas: viz.aguaLinhas.length, restrito: viz.restrito.length, barreiras: viz.barreiras.length, sinaisQueLiberam: viz.libera.length, mataTotal_m2: Math.round(densos.reduce((s, p) => s + turf.area(p), 0)), mataProibida_m2: Math.round(densoEfetivo.reduce((s, p) => s + turf.area(p), 0)) },
  amostrasCaminho: amostras.length, largada: saida.largada, zonasManuais: ZONAS.length, zonasAuto: zonasAuto.length,
  pontos: pontos.length, pontosInseguros: inseguros.size, curas: curas.length, coberturaCura: cobMed(curas),
  pedrasNormais: pedrasNormais.length, pedrasEspeciais: pedrasEspeciais.length, bombas: bombas.length
}, null, 1));

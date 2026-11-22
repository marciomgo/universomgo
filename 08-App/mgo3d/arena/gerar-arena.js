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
const ZONAS = ler('zonas.json', []);                 // zonas do Marcio: {nome,lat,lng,r} (circulo) | {nome,poligono} | {nome,linha,buffer_m} (linha com largura); com semPontos:true = monstros podem, pontos/itens nao
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

// ---- APAGAR: o Marcio clica numa area que o mapa trouxe (agua, predio, mata, restrito, cerca...) e manda apagar; vale tudo que estiver naquele ponto ----
const APAGAR = (OP.apagarNoPonto || []).map((p) => ({ pt: turf.point([p.lng, p.lat]), t: p.t || null })); // t = tipo escolhido (so apaga esse tipo); sem t = apaga tudo no ponto
const apagados = []; // o que foi apagado (o editor mostra em cinza, para poder devolver)
function tentaApagar(nome, c, fechado) {
  if (!APAGAR.length) return false;
  const idx = [];
  try {
    const geo = fechado ? turf.polygon([c]) : turf.lineString(c);
    APAGAR.forEach(({ pt, t }, i) => { if (t && t !== nome) return; if (fechado ? turf.booleanPointInPolygon(pt, geo) : turf.pointToLineDistance(pt, geo, { units: 'meters' }) <= 4) idx.push(i); });
  } catch (er) { return false; }
  if (!idx.length) return false;
  apagados.push({ nome, linha: !fechado, c: c.map((q) => [arred(q[0]), arred(q[1])]), is: idx });
  return true;
}

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
let anel = PERIMETRO_EDITADO ? fechar(PERIMETRO_EDITADO) : aneis[0];
let extrasDoParque = PERIMETRO_EDITADO ? [] : partesDoParque.slice(1); // o contorno que voce desenha no editor e um anel so; sem ele, vale o parque inteiro (todas as partes)
let parque = extrasDoParque.length ? turf.multiPolygon([[anel]].concat(extrasDoParque.map((r) => [r]))) : turf.polygon([anel]);

// ---- LADOS: ruas de carro dividem o parque; cada lado e um perimetro proprio e so UM vale (regras-terreno.json -> lados) ----
const LADOS = []; let ladoPendente = false;
if (!PERIMETRO_EDITADO) {
  let resto = parque;
  area.forEach((e) => {
    const t = e.tags || {}; if (!e.geometry || RT.lados.highway.indexOf(t.highway) < 0 || (t.tunnel && t.tunnel !== 'no')) return;
    const c = coords(e.geometry); if (c.length < 2) return;
    try { const b = turf.buffer(turf.lineString(c), RT.lados.corte_m, { units: 'meters' }); if (!turf.booleanIntersects(b, resto)) return; const d = turf.difference(turf.featureCollection([resto, b])); if (d) resto = d; } catch (er) { }
  });
  const pecas = (resto.geometry.type === 'MultiPolygon' ? resto.geometry.coordinates.map((cc) => turf.polygon(cc)) : [resto])
    .map((p) => ({ p, m2: turf.area(p) })).filter((o) => o.m2 >= RT.lados.area_minima_m2).sort((a, b) => b.m2 - a.m2);
  if (pecas.length >= 2) {
    const alvo = OP.ladoOficial && typeof OP.ladoOficial.lng === 'number' ? turf.point([OP.ladoOficial.lng, OP.ladoOficial.lat]) : null;
    let idx = -1;
    if (alvo) { idx = pecas.findIndex((o) => turf.booleanPointInPolygon(alvo, o.p)); if (idx < 0) { let md = Infinity; pecas.forEach((o, i) => { const d = dist(alvo, turf.centroid(o.p)); if (d < md) { md = d; idx = i; } }); } }
    if (idx < 0) { idx = 0; ladoPendente = true; } // ninguem escolheu ainda: usa o maior de forma provisoria e AVISA
    pecas.forEach((o, i) => { const s = turf.simplify(o.p, { tolerance: 0.000004, highQuality: true }); LADOS.push({ ponto: turf.pointOnFeature(o.p).geometry.coordinates.map(arred), ha: Math.round(o.m2 / 100) / 100, oficial: i === idx, anel: s.geometry.coordinates[0].map((q) => [arred(q[0]), arred(q[1])]) }); });
    anel = fechar(pecas[idx].p.geometry.coordinates[0]); extrasDoParque = []; parque = turf.polygon([anel]);
    console.log('LADOS: o parque e dividido por rua em ' + pecas.length + ' lados (' + pecas.map((o) => Math.round(o.m2 / 100) / 100 + ' ha').join(' / ') + '); oficial: lado ' + (idx + 1) + (ladoPendente ? ' (PROVISORIO: falta voce escolher no editor)' : ''));
  } else if (pecas.length === 1 && extrasDoParque.length) { // varias partes no mapa, mas so uma tem tamanho: fica so com as que tocam nela
    const tocam = partesDoParque.filter((r) => { try { return turf.booleanIntersects(turf.polygon([r]), pecas[0].p); } catch (er) { return false; } });
    if (tocam.length) { anel = tocam[0]; extrasDoParque = tocam.slice(1); parque = extrasDoParque.length ? turf.multiPolygon([[anel]].concat(extrasDoParque.map((r) => [r]))) : turf.polygon([anel]); }
  }
}
if (extrasDoParque.length) OP.usarTodasAsPartes = true; // parque com varias partes (sem rua no meio): a area segura tem que cobrir todas, nao so a maior

// ---- zonas proibidas: as do Marcio (satelite) + as que o mapa mostra (parquinhos e quadras) ----
const simpAnel = (r) => { try { return turf.simplify(turf.polygon([r]), { tolerance: 0.0000035, highQuality: true }).geometry.coordinates[0]; } catch (er) { return r; } }; // ~0,4 m
const poligonoDaZona = (z) => (z.linha ? turf.buffer(turf.lineString(z.linha), z.buffer_m || 3, { units: 'meters' }) : z.poligono ? turf.polygon([fechar(z.poligono)]) : turf.circle([z.lng, z.lat], z.r, { units: 'meters', steps: 48 }));
const zonaManuais = ZONAS.map((z) => (z.semPontos ? null : poligonoDaZona(z))); // null = zona 'sem pontos' (nao bloqueia monstros)
const zonaPoligonos = zonaManuais.filter(Boolean);
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
  const anelBuf = simpAnel(buf && buf.geometry.type === 'Polygon' ? buf.geometry.coordinates[0] : c); // sem os 8 pontinhos de cada canto arredondado (impossivel de puxar no editor)
  const za = { nome: (t.leisure === 'playground' ? 'Parquinho' : 'Quadra') + (t.name ? ' ' + t.name : ''), lat: arred(ct[1]), lng: arred(ct[0]), tipo: t.leisure, poligono: anelBuf.map((q) => [arred(q[0]), arred(q[1])]) };
  if (regraZ.bloquear === false) { zonasAutoLivres.push(za); return; } // tipo que a regra libera (ex.: pracinha): so aparece cinza no editor, nao bloqueia
  if (OP.ignorarZonasAuto.some((q) => Math.abs(q[0] - za.lat) < 1e-6 && Math.abs(q[1] - za.lng) < 1e-6)) { zonasAutoIgnoradas.push(za); return; } // o Marcio mandou ignorar
  zonasAuto.push(za);
  zonaPoligonos.push(buf);
});

// ---- areas SEM PONTOS (ex.: cachorrodromo): monstros podem ficar la (continua no verde), mas largada, bases e itens nao ----
const semPontosPolis = [], semPontosVis = [];
area.forEach((e) => {
  const t = e.tags || {}; if (!e.geometry || !RT.semPontos || RT.semPontos.leisure.indexOf(t.leisure) < 0) return;
  const c = coords(e.geometry); if (!(c.length > 3 && igual(c[0], c[c.length - 1]))) return;
  let poli; try { poli = turf.polygon([c]); } catch (er) { return; }
  if (!turf.booleanIntersects(poli, parque)) return;
  if (tentaApagar('Cachorródromo (sem pontos)', c, true)) return;
  const buf = turf.buffer(poli, RT.semPontos.buffer_m, { units: 'meters' });
  semPontosPolis.push(buf); semPontosVis.push(c.map((q) => [arred(q[0]), arred(q[1])]));
});
ZONAS.forEach((z) => { if (z.semPontos) { try { semPontosPolis.push(poligonoDaZona(z)); } catch (er) { } } }); // zonas 'sem pontos' desenhadas por voce
if (semPontosPolis.length) console.log('areas sem pontos (cachorrodromo): ' + semPontosPolis.length);

// ---- o que so o SATELITE mostra (quadras de areia/coloridas, telhados que o OpenStreetMap nao tem): node detectar-satelite.js <slug> grava satelite-candidatos.json; aqui entra como zona proibida (2 m de folga) ----
const SAT = ler('satelite-candidatos.json', { novos: [] });
let nSat = 0;
(SAT.novos || []).forEach((n) => {
  const c = n.poligono; let poli; try { poli = turf.polygon([c]); } catch (er) { return; }
  if (!turf.booleanIntersects(poli, parque)) return;
  const ct = turf.centroid(poli).geometry.coordinates;
  const buf = turf.buffer(poli, 2, { units: 'meters' });
  const anelBuf = simpAnel(buf && buf.geometry.type === 'Polygon' ? buf.geometry.coordinates[0] : c); // sem os 8 pontinhos de cada canto arredondado (impossivel de puxar no editor)
  const za = { nome: (n.tipo === 'quadra' ? 'Quadra' : 'Construcao') + ' (so no satelite)', lat: arred(ct[1]), lng: arred(ct[0]), tipo: 'satelite', poligono: anelBuf.map((q) => [arred(q[0]), arred(q[1])]) };
  if (OP.ignorarZonasAuto.some((q) => Math.abs(q[0] - za.lat) < 1e-6 && Math.abs(q[1] - za.lng) < 1e-6)) { zonasAutoIgnoradas.push(za); return; }
  zonasAuto.push(za); zonaPoligonos.push(buf); nSat++;
});
if (nSat) console.log('satelite: ' + nSat + ' zonas extras (quadra/construcao que o mapa nao tem)');

// ---- area permitida = parque - predios - agua - ruas de carro - zonas ----
const bloqueios = [], bloqueiosPredios = []; // bloqueiosPredios: so as construcoes do mapa (cortam tambem o verde editado a mao)
const vistaConstrucoes = [], vistaAgua = [], vistaViasCarro = [], vistaViasServico = []; // so para o editor desenhar o que o mapa ja tem
const rr = (c) => c.map((q) => [arred(q[0]), arred(q[1])]);
area.forEach((e) => {
  const t = e.tags || {}; if (!e.geometry) return;
  const c = coords(e.geometry);
  const fechado = c.length > 3 && igual(c[0], c[c.length - 1]);
  const viaCarro = t.highway && ['secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'primary', 'trunk', 'primary_link', 'trunk_link', 'unclassified'].includes(t.highway);
  if ((((t.building || t.natural === 'water' || t.leisure === 'swimming_pool') && fechado) || viaCarro || t.highway === 'service') && tentaApagar(t.building ? 'Prédio' : (t.highway ? 'Rua' : 'Água'), c, !!((t.building || t.natural === 'water' || t.leisure === 'swimming_pool') && fechado))) return;
  if (t.building && fechado) vistaConstrucoes.push(rr(c));
  else if ((t.natural === 'water' || t.leisure === 'swimming_pool') && fechado) vistaAgua.push(rr(c));
  else if (t.highway === 'service') vistaViasServico.push(rr(c));
  else if (t.highway && ['secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'primary', 'trunk', 'primary_link', 'trunk_link', 'unclassified'].includes(t.highway)) vistaViasCarro.push(rr(c));
  if (t.building && fechado) { const bb = turf.buffer(turf.polygon([c]), 2, { units: 'meters' }); bloqueios.push(bb); bloqueiosPredios.push(bb); }
  else if ((t.natural === 'water' || t.leisure === 'swimming_pool') && fechado) bloqueios.push(turf.buffer(turf.polygon([c]), 5, { units: 'meters' }));
  else if (t.highway && ['secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'primary', 'trunk', 'primary_link', 'trunk_link', 'unclassified'].includes(t.highway)) bloqueios.push(turf.buffer(turf.lineString(c), 8, { units: 'meters' }));
  else if (t.highway === 'service') bloqueios.push(turf.buffer(turf.lineString(c), (RT.viasServico && RT.viasServico.folga_cada_lado_m) || 2.5, { units: 'meters' }));
});
// ---- TERRENO (regras em regras-terreno.json): agua, mata densa, areas restritas, cercas, sinais que liberam ----
const casa = (tags, cond) => Object.keys(cond).some((k) => k.charAt(0) !== '_' && k !== 'buffer_m' && k !== 'corredor_da_trilha_m' && k !== 'area_fechada_max_fracao_do_parque' && tags[k] !== undefined && (cond[k] === '*' || (Array.isArray(cond[k]) ? cond[k].indexOf(tags[k]) >= 0 : cond[k] === tags[k])));
const fechadoC = (c) => c.length > 3 && igual(c[0], c[c.length - 1]);
const viz = { tracks: [], agua: [], aguaLinhas: [], mata: [], mataFechada: [], restrito: [], barreiras: [], libera: [] };
const bboxSeCruza = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
const areaParque = turf.area(parque);
const densos = [];
area.forEach((e) => {
  const tg = e.tags || {}; if (!e.geometry) return;
  const c = coords(e.geometry);
  if (tg.highway === 'track' && RT.semPontos.highway.indexOf('track') >= 0 && !tentaApagar('Caminho sem pontos (track)', c, false)) { viz.tracks.push(rr(c)); try { semPontosPolis.push(turf.buffer(turf.lineString(c), RT.semPontos.track_buffer_m, { units: 'meters' })); } catch (er) { } } // caminho sem pontos: monstros sim, pontos/itens nao
  if (fechadoC(c)) {
    let poli; try { poli = turf.polygon([c]); } catch (er) { return; }
    if (!turf.booleanIntersects(poli, parque)) return;
    if (casa(tg, RT.agua.poligonos)) { if (!tentaApagar('Água', c, true)) { bloqueios.push(turf.buffer(poli, RT.agua.buffer_m, { units: 'meters' })); viz.agua.push(rr(c)); } }
    else if (casa(tg, RT.mataDensa)) { if (!tentaApagar('Mata', c, true)) densos.push(poli); }
    else if (casa(tg, RT.restrito) && tg.leisure !== 'park' && !tentaApagar('Área restrita', c, true)) { bloqueios.push(turf.buffer(poli, RT.restrito.buffer_m, { units: 'meters' })); viz.restrito.push(rr(c)); }
    else if (tg.barrier && RT.barreiras.barrier.indexOf(tg.barrier) >= 0 && !tg.leisure && !tg.landuse && !tentaApagar('Área restrita', c, true)) {
      if (turf.area(poli) < areaParque * RT.barreiras.area_fechada_max_fracao_do_parque) { bloqueios.push(turf.buffer(poli, RT.barreiras.buffer_m, { units: 'meters' })); viz.restrito.push(rr(c)); }
      else { bloqueios.push(turf.buffer(turf.lineString(c), RT.barreiras.buffer_m, { units: 'meters' })); viz.barreiras.push(rr(c)); }
    }
  } else if (c.length >= 2) {
    if (tg.waterway && RT.aguaLinhas.waterway.indexOf(tg.waterway) >= 0) { if (tentaApagar('Canal', c, false)) return; bloqueios.push(turf.buffer(turf.lineString(c), RT.aguaLinhas.buffer_m, { units: 'meters' })); viz.aguaLinhas.push(rr(c)); }
    else if (tg.barrier && RT.barreiras.barrier.indexOf(tg.barrier) >= 0 && !tentaApagar('Cerca', c, false)) { bloqueios.push(turf.buffer(turf.lineString(c), RT.barreiras.buffer_m, { units: 'meters' })); viz.barreiras.push(rr(c)); }
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
  const tg = e.tags || {}; if (!e.geometry || RT.trilhas.highway.indexOf(tg.highway) < 0) return;
  if (tg.footway === 'crossing' || tg.access === 'private' || tg.indoor || OP.caminhosRemovidos.indexOf(e.id) >= 0) return;
  trilhasLinhas.push(turf.lineString(coords(e.geometry)));
});
CAM_EXTRA.forEach((c) => trilhasLinhas.push(turf.lineString(c)));
let densoEfetivo = [];
const matasSoPontos = []; // mata COM trilha: monstros podem (continua no verde), ponto/base/item so no corredor da trilha
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
  if (eff) { if (comTrilha && RT.mataDensa.monstros_na_mata_com_trilha) matasSoPontos.push(eff); else densoEfetivo.push(eff); (comTrilha ? viz.mata : viz.mataFechada).push(turf.truncate(eff, { precision: 7 }).geometry); }
});
zonaPoligonos.forEach((z) => bloqueios.push(z));
let permitida = parque;
bloqueios.forEach((b) => { try { const d = turf.difference(turf.featureCollection([permitida, b])); if (d) permitida = d; } catch (e) { } });
// areas liberadas pelo Marcio voltam a valer; as zonas proibidas dele continuam mandando por cima
LIBERAR.forEach((l) => { try { const lp = turf.intersect(turf.featureCollection([turf.polygon([fechar(l)]), parque])); if (lp) { const u = turf.union(turf.featureCollection([permitida, lp])); if (u) permitida = u; } } catch (e) { } });
if (LIBERAR.length) zonaManuais.forEach((b) => { if (!b) return; try { const d = turf.difference(turf.featureCollection([permitida, b])); if (d) permitida = d; } catch (e) { } });
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
// ---- FRESTAS: o verde nao tem pedacinhos soltos nem passagens estreitas entre areas proibidas (regras-terreno.json -> verde) ----
const VD = RT.verde || { largura_minima_m: 6, area_minima_m2: 300 };
function limpaFrestas(gm) {
  if (!gm) return gm;
  try {
    let a = turf.buffer(gm, -VD.largura_minima_m / 2, { units: 'meters' }); if (!a) return null;
    a = turf.buffer(a, VD.largura_minima_m / 2, { units: 'meters' }); if (!a) return gm;
    const polys = a.geometry.type === 'MultiPolygon' ? a.geometry.coordinates : [a.geometry.coordinates];
    const ok = polys.filter((p) => turf.area(turf.polygon(p)) >= VD.area_minima_m2);
    if (!ok.length) return gm;
    const r = ok.length === 1 ? turf.polygon(ok[0]) : turf.multiPolygon(ok);
    return turf.intersect(turf.featureCollection([gm, r])) || gm;
  } catch (er) { return gm; }
}
const verdeAntes = seguroPoli ? turf.area(seguroPoli) : 0;
seguroPoli = limpaFrestas(seguroPoli); interior = limpaFrestas(interior);
if (seguroPoli && verdeAntes) console.log('frestas: verde de ' + Math.round(verdeAntes) + ' m2 para ' + Math.round(turf.area(seguroPoli)) + ' m2 (tira pedacos menores que ' + VD.area_minima_m2 + ' m2 e passagens mais estreitas que ' + VD.largura_minima_m + ' m)');
// ---- area verde editada a mao: vira a area segura final (as zonas proibidas desenhadas por ele continuam cortando); o contorno do jogo cresce para conter o verde ----
let seguraEditada = false, anelFinal = anel;
if (SEGURA_EDITADA && SEGURA_EDITADA.length && seguroPoli) { // aviso: verde "editado" congela o verde e deixa de receber as regras novas
  try {
    const edi = turf.multiPolygon(SEGURA_EDITADA);
    const d1 = turf.difference(turf.featureCollection([edi, seguroPoli])), d2 = turf.difference(turf.featureCollection([seguroPoli, edi]));
    const dif = (d1 ? turf.area(d1) : 0) + (d2 ? turf.area(d2) : 0);
    if (dif < 0.03 * turf.area(seguroPoli)) console.log('AVISO: o verde editado a mao difere so ' + Math.round(dif) + ' m2 (' + (100 * dif / turf.area(seguroPoli)).toFixed(1) + '%) do automatico. Ele fica CONGELADO e nao recebe as regras novas; se foi sem querer, use "voltar verde automatico" no editor.');
  } catch (er) { }
}
if (SEGURA_EDITADA && SEGURA_EDITADA.length) {
  seguraEditada = true;
  seguroPoli = turf.multiPolygon(SEGURA_EDITADA);
  zonaManuais.forEach((z) => { if (!z) return; try { const d = turf.difference(turf.featureCollection([seguroPoli, z])); if (d) seguroPoli = d; } catch (e) { } });
  // zonas vermelhas AUTOMATICAS ativas (quadra, parquinho, construcao do satelite) tambem cortam o verde editado: se nao era para bloquear, voce usa "Apagar" nelas ou "Liberar"
  const nManuais = zonaManuais.filter(Boolean).length;
  let libUniao = null; LIBERAR.forEach((l) => { try { const lp = turf.polygon([fechar(l)]); libUniao = libUniao ? turf.union(turf.featureCollection([libUniao, lp])) : lp; } catch (e) { } });
  const verdeAntesCorte = turf.area(seguroPoli);
  zonaPoligonos.slice(nManuais).concat(bloqueiosPredios).forEach((z0) => { // + as construcoes do mapa: o verde editado nao pode cobrir predio (agua e ruas ficam como voce pintou)
    let z = z0; if (libUniao) { try { z = turf.difference(turf.featureCollection([z0, libUniao])); } catch (e) { z = z0; } } if (!z) return;
    try { const d = turf.difference(turf.featureCollection([seguroPoli, z])); if (d) seguroPoli = d; } catch (e) { }
  });
  console.log('verde editado: cortado ' + Math.round(verdeAntesCorte - turf.area(seguroPoli)) + ' m2 por zonas automaticas e construcoes do mapa');
  interior = seguroPoli;
  try {
    const u = turf.union(turf.featureCollection([parque, seguroPoli]));
    const partes = u.geometry.type === 'MultiPolygon' ? u.geometry.coordinates.map((c) => turf.polygon(c)) : [u];
    partes.sort((a, b) => turf.area(b) - turf.area(a));
    anelFinal = partes[0].geometry.coordinates[0];
    if (partes.length > 1) console.log('aviso: o verde editado tem partes separadas do contorno amarelo; o contorno do jogo usa so a maior juncao');
  } catch (e) { console.log('aviso: nao consegui juntar o verde ao contorno'); }
}

// area onde podem ficar largada, bases e itens = verde menos as areas sem pontos (o verde dos monstros, seguroPoli, nao muda)
let seguroPontos = seguroPoli;
matasSoPontos.concat(semPontosPolis).forEach((b) => {
  try { if (seguroPontos) { const x = turf.difference(turf.featureCollection([seguroPontos, b])); if (x) seguroPontos = x; } } catch (er) { }
  try { const y = turf.difference(turf.featureCollection([interior, b])); if (y) interior = y; } catch (er) { }
});

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
  if (!e.geometry || !RT.trilhas.highway.includes(t.highway)) return;
  if (t.footway === 'crossing' || t.access === 'private' || t.indoor) return;
  const c = coords(e.geometry);
  if (OP.caminhosRemovidos.includes(e.id)) { caminhosRemovidos.push({ id: e.id, c: c.map((q) => [arred(q[0]), arred(q[1])]) }); return; } // o Marcio mandou tirar
  addCaminho(c, e.id);
});
CAM_EXTRA.forEach((c) => addCaminho(c, null)); // trilhas que o Marcio desenhou
if (amostras.length < 50 && OP.modoPontos === 'area' && interior) { // parque de gramado sem caminho dentro do verde: usa pontos sorteados dentro do verde como guia (nao precisa de trilha)
  const bb = turf.bbox(interior); let tent = 0, sm = 424242; const rnd = () => { sm = (sm * 16807) % 2147483647; return (sm - 1) / 2147483646; }; while (amostras.length < 400 && tent++ < 20000) { const p = turf.point([bb[0] + rnd() * (bb[2] - bb[0]), bb[1] + rnd() * (bb[3] - bb[1])]); if (turf.booleanPointInPolygon(p, interior)) amostras.push(p); }
  console.log('aviso: nenhum caminho de pedestre dentro do verde; parque de gramado usa pontos sorteados no verde como guia (' + amostras.length + ')');
}
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
  ZONAS.forEach((z, i) => { if (!zonaManuais[i]) return; ds.push((z.poligono || z.linha) ? turf.pointToPolygonDistance(p, zonaManuais[i], { units: 'meters' }) : dist(p, turf.point([z.lng, z.lat])) - z.r); });
  zonasAuto.forEach((z) => { try { ds.push(turf.pointToPolygonDistance(p, turf.polygon([z.poligono]), { units: 'meters' })); } catch (e) { ds.push(dist(p, turf.point([z.lng, z.lat])) - 18); } });
  return Math.min(...ds);
};
let largada = null, melhor = Infinity;
amostras.forEach((p) => {
  if (distZona(p) < 15) return;
  if (!seguroPontos || !turf.booleanPointInPolygon(p, seguroPontos)) return;
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
  const p = EM_AREA ? pontoNaArea(seguroPontos) : turf.destination(base, aleatorio() * 8, aleatorio() * 360, { units: 'meters' });
  if (!p) { falhas++; continue; }
  if (!seguroPontos || !turf.booleanPointInPolygon(p, seguroPontos)) { falhas++; continue; }
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

// ---- PISCINAS DE LOCAIS VALIDOS (para a largada livre): muitos lugares possiveis, ja respeitando todas as regras. Na hora do jogo o percurso e SORTEADO entre eles
// e so DEPOIS os itens sao colocados perto do percurso (numero fixo por percurso). Sorteio com semente fixa: o gerador sempre da as mesmas piscinas. ----
const dF = (a, b) => { const dl = (b[1] - a[1]) * 111320, dn = (b[0] - a[0]) * 111320 * Math.cos(a[1] * rad2); return Math.sqrt(dl * dl + dn * dn); };
const rad2 = Math.PI / 180;
function piscina(sorteio, espacoM, max, tentativas) {
  const out = []; let f = 0;
  while (out.length < max && f < tentativas) {
    const c = sorteio(); if (!c) { f++; continue; }
    if (out.some((q) => dF(c, q) < espacoM)) { f++; continue; }
    out.push(c);
  }
  return out;
}
const comPerto = (poli, base) => { const p = turf.destination(base, aleatorio() * 8, aleatorio() * 360, { units: 'meters' }); return turf.booleanPointInPolygon(p, poli) ? p.geometry.coordinates : null; };
const sorteioPonto = (poli) => () => { if (!poli) return null; if (EM_AREA) { const p = pontoNaArea(poli); return p ? p.geometry.coordinates : null; } return comPerto(poli, amostras[Math.floor(aleatorio() * amostras.length)]); };
const poolPontos = piscina(sorteioPonto(seguroPontos), 14, 1100, 40000);
const poolItens = piscina(sorteioPonto(interior), 10, 1100, 40000);
const poolBombas = piscina(() => { const p = EM_AREA ? pontoNaArea(interior) : amostras[Math.floor(aleatorio() * amostras.length)]; return p ? p.geometry.coordinates : null; }, 5, 2200, 60000);
const arr6 = (l) => l.map((c) => [Math.round(c[1] * 1e6) / 1e6, Math.round(c[0] * 1e6) / 1e6]); // [lat, lng]
console.log('piscinas: pontos ' + poolPontos.length + ', itens ' + poolItens.length + ', bombas ' + poolBombas.length);

const ll = (p) => ({ lat: arred(p.geometry.coordinates[1]), lng: arred(p.geometry.coordinates[0]) });
const cobMed = (lista) => { if (!lista.length) return null; const ds = pontos.map((p) => Math.round(Math.min(...lista.map((c) => dist(p, c))))); return { mediana: ds.slice().sort((a, b) => a - b)[Math.floor(ds.length / 2)], maximo: Math.max(...ds) }; };
const seguraGeo = seguroPoli ? turf.truncate(turf.simplify(seguroPoli, { tolerance: 0.00001, highQuality: true }), { precision: 7 }).geometry : null;

// as trilhas sao cortadas pelo CONTORNO do jogo (nao deixam sair do perimetro): so ficam os pedacos de dentro
const partesFinais = [turf.polygon([anelFinal])].concat(extrasDoParque.map((r) => turf.polygon([r])));
function recortarEm(c, P) { // pedacos da linha que ficam dentro de UM poligono
  const l = turf.lineString(c);
  if (!turf.booleanIntersects(l, P)) return [];
  const partes = turf.lineSplit(l, turf.polygonToLine(P));
  const fs2 = (partes.features && partes.features.length) ? partes.features : [l];
  return fs2.filter((f) => { const L2 = turf.length(f, { units: 'meters' }); return turf.booleanPointInPolygon(turf.along(f, L2 / 2, { units: 'meters' }), P); }).map((f) => f.geometry.coordinates);
}
function recortarNoParque(c) {
  const out = [];
  partesFinais.forEach((P) => { try { recortarEm(c, P).forEach((p) => out.push(p)); } catch (e) { if (c.every((q) => turf.booleanPointInPolygon(q, P))) out.push(c); } });
  return out;
}
const noPerimetro = recortarNoParque; // trilhas, canais e cercas: nada passa do perimetro
const vLin = (arr) => [].concat(...arr.map((c) => recortarNoParque(c))); // o editor mostra SO o que esta dentro do perimetro
const vLinPer = vLin;
function vPoly(arr) { // poligonos (predios, agua...) cortados pelo perimetro; o que esta fora some
  const out = [];
  arr.forEach((c) => { let poli; try { poli = turf.polygon([c]); } catch (er) { return; }
    partesFinais.forEach((P) => { try { if (!turf.booleanIntersects(poli, P)) return; const x = turf.intersect(turf.featureCollection([poli, P])); if (!x) return; (x.geometry.type === 'Polygon' ? [x.geometry.coordinates] : x.geometry.coordinates).forEach((g2) => out.push(g2[0].map((q) => [arred(q[0]), arred(q[1])]))); } catch (er) { out.push(c); } }); });
  return out;
}
const dentroDoPerimetro = (lng, lat) => partesFinais.some((P) => turf.booleanPointInPolygon([lng, lat], P));
const camRec = []; caminhos.forEach((c, i) => recortarNoParque(c).forEach((p) => camRec.push({ c: p, id: caminhosIds[i] })));
const saida = {
  slug,
  lados: LADOS, ladoPendente, apagarNoPonto: OP.apagarNoPonto || [],
  apagados: apagados.filter((o, i, arr) => arr.findIndex((q) => JSON.stringify(q.c) === JSON.stringify(o.c)) === i).filter((o) => { try { return partesFinais.some((P) => turf.booleanIntersects(o.linha ? turf.lineString(o.c) : turf.polygon([o.c]), P)); } catch (er) { return false; } }),
  nome: (rel.tags && rel.tags.name) || slug,
  largada: ll(largada),
  perimetro: JSON.stringify(anelFinal.map((c) => [arred(c[0]), arred(c[1])])), perimetroExtra: JSON.stringify(extrasDoParque.map((r) => r.map((c) => [arred(c[0]), arred(c[1])]))), perimetroOriginal: JSON.stringify(anelOriginalOSM.map((c) => [arred(c[0]), arred(c[1])])), seguraEditada,
  pontos: pontos.map((p, i) => Object.assign({ codigo: i + 1, distLargada: Math.round(dist(p, largada)), distCaminho: Math.round(distCaminho(p)), seguro: !inseguros.has(p) }, ll(p))),
  curas: curas.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  pedrasNormais: pedrasNormais.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  pedrasEspeciais: pedrasEspeciais.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  bombas: bombas.map((p, i) => Object.assign({ codigo: i + 1 }, ll(p))),
  poolPontos: arr6(poolPontos), poolItens: arr6(poolItens), poolBombas: arr6(poolBombas),
  terreno: { monstrosNaMata: !!RT.mataDensa.monstros_na_mata_com_trilha, tracks: vLin(viz.tracks), semPontos: semPontosVis, agua: vPoly(viz.agua), aguaLinhas: vLinPer(viz.aguaLinhas), mata: viz.mata, mataFechada: viz.mataFechada, restrito: vPoly(viz.restrito), barreiras: vLinPer(viz.barreiras), libera: viz.libera.filter((z) => dentroDoPerimetro(z.lng, z.lat)) },
  construcoes: vPoly(vistaConstrucoes), agua: vPoly(vistaAgua), viasCarro: vLin(vistaViasCarro), viasServico: vLin(vistaViasServico),
  zonas: ZONAS, zonasAuto, zonasAutoIgnoradas, zonasAutoLivres, liberar: LIBERAR, caminhosExtra: CAM_EXTRA, caminhosRemovidos: [].concat(...caminhosRemovidos.map((o) => noPerimetro(o.c).map((p) => ({ id: o.id, c: p.map((q) => [arred(q[0]), arred(q[1])]) })))),
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

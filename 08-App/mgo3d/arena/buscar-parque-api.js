// Plano B quando a Overpass esta lotada: baixa os mesmos dados pela API oficial do OpenStreetMap (api.openstreetmap.org)
// e grava no MESMO formato (rel.json, area.json, ent.json) que o buscar-parque.js. Uso: node buscar-parque-api.js <slug> <relation|way> <id>
const fs = require('fs'); const path = require('path');
const API = 'https://api.openstreetmap.org/api/0.6';
const UA = { 'User-Agent': 'MGO-gerador/1.0 (projeto educacional)' };
async function get(url, tent = 4) {
  let espera = 3000;
  for (let t = 0; t < tent; t++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90000) });
      if (r.ok) return await r.json();
      console.error('  [api] ' + r.status + ' ' + url.slice(API.length, API.length + 70));
      if (r.status === 400 || r.status === 404) throw Object.assign(new Error('HTTP ' + r.status), { fatal: true });
    } catch (e) { if (e.fatal) throw e; console.error('  [api] ' + e.message); }
    await new Promise((ok) => setTimeout(ok, espera)); espera *= 1.7;
  }
  throw new Error('API indisponivel: ' + url);
}
const querTags = (t) => !!(t.highway || t.building || t.natural || t.waterway || t.landuse || t.barrier || t.water || t.wetland || t.man_made || t.railway || (t.access && t.access !== 'yes') || ['swimming_pool', 'playground', 'pitch', 'sports_centre', 'stadium', 'golf_course', 'dog_park', 'garden'].includes(t.leisure) || ['parking', 'school', 'hospital', 'university', 'college', 'kindergarten', 'fuel'].includes(t.amenity));
const igualPt = (a, b) => Math.abs(a.lon - b.lon) < 1e-9 && Math.abs(a.lat - b.lat) < 1e-9;
function costurar(pedacos) { // junta pedacos de linha em aneis fechados
  const aneis = []; const pool = pedacos.map((w) => w.slice());
  while (pool.length) {
    let cur = pool.shift(); let mudou = true;
    while (mudou && !igualPt(cur[0], cur[cur.length - 1])) {
      mudou = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        if (igualPt(cur[cur.length - 1], w[0])) { cur = cur.concat(w.slice(1)); pool.splice(i, 1); mudou = true; break; }
        if (igualPt(cur[cur.length - 1], w[w.length - 1])) { cur = cur.concat(w.slice().reverse().slice(1)); pool.splice(i, 1); mudou = true; break; }
        if (igualPt(cur[0], w[w.length - 1])) { cur = w.concat(cur.slice(1)); pool.splice(i, 1); mudou = true; break; }
        if (igualPt(cur[0], w[0])) { cur = w.slice().reverse().concat(cur.slice(1)); pool.splice(i, 1); mudou = true; break; }
      }
    }
    if (igualPt(cur[0], cur[cur.length - 1]) && cur.length >= 4) aneis.push(cur);
  }
  return aneis;
}
const indice = (els) => { const no = new Map(), vias = new Map(); els.forEach((e) => { if (e.type === 'node') no.set(e.id, e); else if (e.type === 'way') vias.set(e.id, e); }); return { no, vias }; };
const geom = (via, no) => via.nodes.map((id) => no.get(id)).filter(Boolean).map((n) => ({ lat: n.lat, lon: n.lon }));
const limites = (pts) => ({ minlat: Math.min(...pts.map((p) => p.lat)), maxlat: Math.max(...pts.map((p) => p.lat)), minlon: Math.min(...pts.map((p) => p.lon)), maxlon: Math.max(...pts.map((p) => p.lon)) });

(async () => {
  const args = process.argv.slice(2); const forcar = args.includes('--forcar'); const soRelacoes = args.includes('--so-relacoes'); const [slug, tipo, id] = args.filter((x) => x.indexOf('--') !== 0);
  if (!slug || (!soRelacoes && (!tipo || !id))) { console.error('uso: node buscar-parque-api.js <slug> <relation|way> <id>'); process.exit(1); }
  const dir = path.join(__dirname, 'parques', slug); fs.mkdirSync(dir, { recursive: true });
  const salvar = (n, o) => fs.writeFileSync(path.join(dir, n), JSON.stringify(o));
  const existe = (n) => !forcar && fs.existsSync(path.join(dir, n)) || (forcar && (n === 'rel.json' || n === 'zonas.json') && fs.existsSync(path.join(dir, n)));

  // 1) contorno (mesmo formato do "out geom": way com geometry; relation com members[].geometry)
  if (!soRelacoes && !existe('rel.json')) {
    const full = await get(API + '/' + tipo + '/' + id + '/full.json');
    const { no, vias } = indice(full.elements);
    let el;
    if (tipo === 'way') { const v = vias.get(+id); const g = geom(v, no); el = { type: 'way', id: +id, bounds: limites(g), geometry: g, tags: v.tags || {} }; }
    else {
      const r = full.elements.find((e) => e.type === 'relation');
      const members = r.members.filter((m) => m.type === 'way').map((m) => ({ type: 'way', ref: m.ref, role: m.role, geometry: vias.get(m.ref) ? geom(vias.get(m.ref), no) : [] }));
      const todos = [].concat(...members.map((m) => m.geometry));
      el = { type: 'relation', id: +id, bounds: limites(todos), members, tags: r.tags || {} };
    }
    salvar('rel.json', { elements: [el] }); console.log('contorno ok (' + (el.tags.name || slug) + ')');
  }
  const rel = JSON.parse(fs.readFileSync(path.join(dir, 'rel.json'), 'utf8')).elements[0];
  const b = rel.bounds, m = 0.0006;
  const S = b.minlat - m, W = b.minlon - m, N = b.maxlat + m, E = b.maxlon + m;

  // 2) tudo dentro da caixa, em pedacos (a API limita 50 mil pontos por pedido)
  const relacoes = new Map(); // multipoligonos (ex.: lagos grandes): o desenho fica em vias SEM etiqueta, a etiqueta fica na relacao
  if (soRelacoes || !existe('area.json') || !existe('ent.json')) {
    const areaEls = [], entEls = [], vistos = new Set();
    const cols = Math.max(1, Math.ceil((E - W) / 0.006)), lins = Math.max(1, Math.ceil((N - S) / 0.006));
    for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) {
      const w = W + ((E - W) * i) / cols, e = W + ((E - W) * (i + 1)) / cols, s = S + ((N - S) * j) / lins, n = S + ((N - S) * (j + 1)) / lins;
      const d = await get(API + '/map.json?bbox=' + [w, s, e, n].map((x) => x.toFixed(6)).join(','));
      const { no, vias } = indice(d.elements);
      d.elements.forEach((el) => {
        const t = el.tags || {};
        if (el.type === 'relation' && t.type === 'multipolygon' && querTags(t)) relacoes.set(el.id, t);
        if (el.type === 'node') {
          if (['toilets', 'drinking_water', 'bbq', 'shelter', 'bench'].includes(t.amenity) || t.entrance || ['picnic_table', 'firepit', 'bbq'].includes(t.leisure) || t.tourism === 'picnic_site' || t.barrier === 'gate' || t.barrier === 'lift_gate') { const k = 'n' + el.id; if (!vistos.has(k)) { vistos.add(k); entEls.push({ type: 'node', id: el.id, lat: el.lat, lon: el.lon, tags: t }); } }
        } else if (el.type === 'way') {
          const quer = querTags(t);
          const k = 'w' + el.id; if (!quer || vistos.has(k)) return; vistos.add(k);
          const g = geom(el, no); if (g.length >= 2 && t.natural !== 'tree_row') areaEls.push({ type: 'way', id: el.id, geometry: g, tags: t });
        }
      });
      console.log('  pedaco ' + (i * lins + j + 1) + '/' + cols * lins + ' ok');
    }
    // relacoes multipoligono: baixa cada uma inteira e vira um "way" com as etiquetas da relacao (id 'r<id>_<n>')
    let nRel = 0; const relEls = [];
    for (const [rid, t] of relacoes) {
      try {
        const full = await get(API + '/relation/' + rid + '/full.json');
        const { no, vias } = indice(full.elements);
        const r = full.elements.find((e) => e.type === 'relation'); if (!r || r.members.length > 120) continue;
        const pedacos = r.members.filter((m) => m.type === 'way' && m.role !== 'inner' && vias.get(m.ref)).map((m) => geom(vias.get(m.ref), no)).filter((g) => g.length >= 2);
        costurar(pedacos).forEach((anel, k) => { relEls.push({ type: 'way', id: 'r' + rid + '_' + k, geometry: anel, tags: t }); nRel++; });
      } catch (e) { console.error('  [relacao ' + rid + '] ' + e.message); }
    }
    if (soRelacoes) {
      const f = path.join(dir, 'area.json'); const atual = JSON.parse(fs.readFileSync(f, 'utf8'));
      atual.elements = atual.elements.filter((e) => !(typeof e.id === 'string' && e.id.charAt(0) === 'r')).concat(relEls);
      fs.writeFileSync(f, JSON.stringify(atual));
      console.log(slug + ': ' + nRel + ' contornos de multipoligono (' + relEls.map((e) => (e.tags.name || e.tags.natural || e.tags.landuse || e.tags.leisure || '?')).join(', ') + ')');
    } else {
      relEls.forEach((e) => areaEls.push(e));
      if (!existe('area.json')) salvar('area.json', { elements: areaEls });
      if (!existe('ent.json')) salvar('ent.json', { elements: entEls });
      console.log('area ' + areaEls.length + ' elementos (' + nRel + ' de multipoligono); entradas/banheiros/bebedouros ' + entEls.length);
    }
  }
  if (!existe('zonas.json')) salvar('zonas.json', []);
  console.log(slug + ' pronto');
})().catch((e) => { console.error('ERRO: ' + e.message); process.exit(1); });

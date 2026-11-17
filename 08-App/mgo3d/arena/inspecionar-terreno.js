// Diagnostico: sinais de TERRENO do OpenStreetMap dentro do contorno (mata, alagadico, agua, churrasqueira/piquenique...).
const turf = require('@turf/turf'); const fs = require('fs'); const path = require('path');
const API = 'https://api.openstreetmap.org/api/0.6'; const UA = { 'User-Agent': 'MGO-gerador/1.0 (projeto educacional)' };
async function get(u) { for (let t = 0; t < 4; t++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(90000) }); if (r.ok) return r.json(); } catch (e) { } await new Promise((k) => setTimeout(k, 3000 * (t + 1))); } throw new Error('API falhou'); }
(async () => {
  const slug = process.argv[2]; const dir = path.join(__dirname, 'parques', slug);
  const arena = JSON.parse(fs.readFileSync(path.join(dir, 'arena.json'), 'utf8'));
  const par = turf.polygon([JSON.parse(arena.perimetro)]); const [W, S, E, N] = turf.bbox(par);
  const cols = Math.max(1, Math.ceil((E - W) / 0.006)), lins = Math.max(1, Math.ceil((N - S) / 0.006));
  const areas = {}, nos = {}; const vistos = new Set();
  for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) {
    const w = W + ((E - W) * i) / cols, e = W + ((E - W) * (i + 1)) / cols, s = S + ((N - S) * j) / lins, n = S + ((N - S) * (j + 1)) / lins;
    const d = await get(API + '/map.json?bbox=' + [w, s, e, n].map((x) => x.toFixed(6)).join(','));
    const no = new Map(); d.elements.forEach((x) => { if (x.type === 'node') no.set(x.id, x); });
    d.elements.forEach((x) => {
      if (vistos.has(x.type + x.id)) return; vistos.add(x.type + x.id);
      const t = x.tags || {};
      if (x.type === 'node') {
        if (!turf.booleanPointInPolygon([x.lon, x.lat], par)) return;
        ['amenity:bbq', 'leisure:picnic_table', 'tourism:picnic_site', 'leisure:firepit', 'amenity:shelter', 'amenity:bench', 'leisure:bbq', 'natural:tree'].forEach((k) => { const [a, b] = k.split(':'); if (t[a] === b) nos[k] = (nos[k] || 0) + 1; });
        return;
      }
      if (x.type !== 'way') return;
      const pts = x.nodes.map((id) => no.get(id)).filter(Boolean); if (pts.length < 4) return;
      const c = pts.map((p) => [p.lon, p.lat]); if (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) return;
      const poli = turf.polygon([c]); let dentro; try { dentro = turf.intersect(turf.featureCollection([par, poli])); } catch (er) { return; } if (!dentro) return;
      const m2 = turf.area(dentro);
      const chaves = [];
      if (t.natural) chaves.push('natural=' + t.natural); if (t.landuse) chaves.push('landuse=' + t.landuse);
      if (t.wetland) chaves.push('wetland=' + t.wetland); if (t.water) chaves.push('water=' + t.water);
      if (t.leisure && ['garden', 'nature_reserve', 'picnic_table', 'common'].includes(t.leisure)) chaves.push('leisure=' + t.leisure);
      if (t.boundary) chaves.push('boundary=' + t.boundary);
      chaves.forEach((k) => { areas[k] = areas[k] || { n: 0, m2: 0 }; areas[k].n++; areas[k].m2 += m2; });
    });
  }
  console.log('\n' + slug + '  (contorno ' + Math.round(turf.area(par)) + ' m2)');
  console.log('  AREAS dentro do contorno:'); Object.entries(areas).sort((a, b) => b[1].m2 - a[1].m2).forEach(([k, v]) => console.log('   ' + k.padEnd(26), String(v.n).padStart(3) + ' poligonos', String(Math.round(v.m2)).padStart(8) + ' m2'));
  console.log('  PONTOS dentro do contorno:', JSON.stringify(nos));
})().catch((e) => { console.error(e.message); process.exit(1); });

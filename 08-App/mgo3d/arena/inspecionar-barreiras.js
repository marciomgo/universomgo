// Diagnostico: o que o OpenStreetMap tem DENTRO do contorno do parque alem do que o gerador usa hoje (cercas, muros, usos do solo, acesso restrito...).
const turf = require('@turf/turf'); const fs = require('fs'); const path = require('path');
const API = 'https://api.openstreetmap.org/api/0.6'; const UA = { 'User-Agent': 'MGO-gerador/1.0 (projeto educacional)' };
async function get(u) { for (let t = 0; t < 4; t++) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(90000) }); if (r.ok) return r.json(); } catch (e) { } await new Promise((k) => setTimeout(k, 3000 * (t + 1))); } throw new Error('API falhou'); }
(async () => {
  const slug = process.argv[2]; const dir = path.join(__dirname, 'parques', slug);
  const arena = JSON.parse(fs.readFileSync(path.join(dir, 'arena.json'), 'utf8'));
  const par = turf.polygon([JSON.parse(arena.perimetro)]); const [W, S, E, N] = turf.bbox(par);
  const cols = Math.max(1, Math.ceil((E - W) / 0.006)), lins = Math.max(1, Math.ceil((N - S) / 0.006));
  const cont = {}, exemplos = {}; const vistos = new Set();
  const soma = (k, e) => { cont[k] = (cont[k] || 0) + 1; (exemplos[k] = exemplos[k] || []).length < 1 && exemplos[k].push(e.id); };
  for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) {
    const w = W + ((E - W) * i) / cols, e = W + ((E - W) * (i + 1)) / cols, s = S + ((N - S) * j) / lins, n = S + ((N - S) * (j + 1)) / lins;
    const d = await get(API + '/map.json?bbox=' + [w, s, e, n].map((x) => x.toFixed(6)).join(','));
    const no = new Map(); d.elements.forEach((x) => { if (x.type === 'node') no.set(x.id, x); });
    d.elements.forEach((x) => {
      if (vistos.has(x.type + x.id)) return; vistos.add(x.type + x.id);
      const t = x.tags || {}; if (!Object.keys(t).length) return;
      let dentro = false;
      if (x.type === 'way') { const pts = x.nodes.map((id) => no.get(id)).filter(Boolean); if (!pts.length) return; const m = pts[Math.floor(pts.length / 2)]; dentro = turf.booleanPointInPolygon([m.lon, m.lat], par); }
      else if (x.type === 'node') dentro = turf.booleanPointInPolygon([x.lon, x.lat], par);
      if (!dentro) return;
      if (t.barrier) soma('barrier=' + t.barrier + (x.type === 'node' ? ' (ponto)' : ''), x);
      if (t.landuse) soma('landuse=' + t.landuse, x);
      if (t.access && t.access !== 'yes') soma('access=' + t.access, x);
      if (t.railway) soma('railway=' + t.railway, x);
      if (t.amenity && x.type === 'way') soma('amenity=' + t.amenity + ' (area)', x);
      if (t.man_made) soma('man_made=' + t.man_made, x);
      if (t.waterway) soma('waterway=' + t.waterway, x);
      if (t.natural && t.natural !== 'tree' && t.natural !== 'water') soma('natural=' + t.natural, x);
      if (t.leisure && !['pitch', 'playground', 'swimming_pool', 'park'].includes(t.leisure) && x.type === 'way') soma('leisure=' + t.leisure, x);
      if (t.tourism && x.type === 'way') soma('tourism=' + t.tourism, x);
    });
  }
  console.log(slug, '-> o que o OSM tem dentro do contorno e o gerador hoje IGNORA:');
  Object.entries(cont).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + String(v).padStart(4), k));
})().catch((e) => { console.error(e.message); process.exit(1); });

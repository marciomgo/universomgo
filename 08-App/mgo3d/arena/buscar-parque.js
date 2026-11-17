// Baixa do OpenStreetMap os dados de UM parque: contorno (rel.json), caminhos/predios/agua/ruas (area.json) e banheiros/bebedouros/entradas (ent.json).
// Uso: node buscar-parque.js <slug> <relation|way> <id>
const fs = require('fs'); const path = require('path'); const { consultar } = require('./overpass');
(async () => {
  const [slug, tipo, id] = process.argv.slice(2);
  if (!slug || !tipo || !id) { console.error('uso: node buscar-parque.js <slug> <relation|way> <id>'); process.exit(1); }
  const dir = path.join(__dirname, 'parques', slug); fs.mkdirSync(dir, { recursive: true });
  const salvar = (n, o) => fs.writeFileSync(path.join(dir, n), JSON.stringify(o));
  if (!fs.existsSync(path.join(dir, 'rel.json'))) {
    const alvo = tipo === 'relation' ? 'rel' : 'way';
    const rel = await consultar('[out:json][timeout:60];' + alvo + '(' + id + ');out geom;'); salvar('rel.json', rel); console.log('contorno ok');
  }
  const rel = JSON.parse(fs.readFileSync(path.join(dir, 'rel.json'), 'utf8')).elements[0];
  let b = rel.bounds; if (!b) { const pts = (rel.geometry || []); b = { minlat: Math.min(...pts.map((p) => p.lat)), maxlat: Math.max(...pts.map((p) => p.lat)), minlon: Math.min(...pts.map((p) => p.lon)), maxlon: Math.max(...pts.map((p) => p.lon)) }; }
  const m = 0.0006; const bbox = [b.minlat - m, b.minlon - m, b.maxlat + m, b.maxlon + m].map((x) => +x.toFixed(6)).join(',');
  if (!fs.existsSync(path.join(dir, 'area.json'))) {
    const qa = '[out:json][timeout:120];(way["highway"](' + bbox + ');way["building"](' + bbox + ');way["natural"="water"](' + bbox + ');way["leisure"~"swimming_pool|playground|pitch"](' + bbox + '););out geom;';
    salvar('area.json', await consultar(qa)); console.log('area ok');
  }
  if (!fs.existsSync(path.join(dir, 'ent.json'))) {
    const qe = '[out:json][timeout:60];(node["amenity"~"toilets|drinking_water"](' + bbox + ');node["entrance"](' + bbox + '););out;';
    salvar('ent.json', await consultar(qe)); console.log('entradas ok');
  }
  if (!fs.existsSync(path.join(dir, 'zonas.json'))) salvar('zonas.json', []);
  console.log(slug, 'pronto, bbox', bbox);
})().catch((e) => { console.error(e.message); process.exit(1); });

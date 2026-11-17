// Construções planas (marcadas no chão, como no Pokémon GO): troca a camada 3D 'predio' por contorno + preenchimento chato.
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes("id: 'predio-borda'")) { console.log('já aplicado'); process.exit(0); }
const r = (a, b) => { if (m.split(a).length !== 2) throw new Error('falta ' + a.slice(0, 70)); m = m.replace(a, () => b); };
const i0 = m.indexOf("    { id: 'predio', type: 'fill-extrusion'"), i1 = m.indexOf('    // nuvem de zona do chefão');
if (i0 < 0 || i1 < 0) throw new Error('camada predio');
m = m.slice(0, i0) + `    // construções planas, só marcadas no chão (sem 3D); o desenho vem do OpenStreetMap
    { id: 'predio', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#e9d2b0', 'fill-opacity': 0.95 } },
    { id: 'predio-borda', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'line-color': '#b98f62', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 20, 2] } },
` + m.slice(i1);
r(`  mapa.setLayoutProperty('predio', 'visibility', satelite ? 'none' : 'visible');`, `  mapa.setLayoutProperty('predio', 'visibility', satelite ? 'none' : 'visible');
  mapa.setLayoutProperty('predio-borda', 'visibility', satelite ? 'none' : 'visible');`);
fs.writeFileSync(__dirname + '/proto-modelo.html', m);
console.log('ok');

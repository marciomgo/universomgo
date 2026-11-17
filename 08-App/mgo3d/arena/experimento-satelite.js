// EXPERIMENTO: da para separar "mata densa" de "gramado" so pela foto de satelite? Gabarito = poligonos do OpenStreetMap.
const turf = require('@turf/turf'); const jpeg = require('jpeg-js'); const fs = require('fs'); const path = require('path');
const Z = 18, N = 2 ** Z;
const tileDe = (lat, lng) => [Math.floor((lng + 180) / 360 * N), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * N)];
const pixLatLng = (x, y, px, py) => { const lng = (x + px / 256) / N * 360 - 180; const n = Math.PI * (1 - 2 * (y + py / 256) / N); return [lng, 180 / Math.PI * Math.atan(Math.sinh(n))]; };
async function tile(x, y) { const f = path.join(process.env.TEMP, `esri-${Z}-${x}-${y}.jpg`); let buf; if (fs.existsSync(f)) buf = fs.readFileSync(f); else { const r = await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}`, { headers: { 'User-Agent': 'MGO-teste/1.0' } }); buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f, buf); } return jpeg.decode(buf, { useTArray: true }); }
(async () => {
  const slug = process.argv[2]; const dir = path.join(__dirname, 'parques', slug);
  const area = JSON.parse(fs.readFileSync(path.join(dir, 'area.json'), 'utf8')).elements;
  const arena = JSON.parse(fs.readFileSync(path.join(dir, 'arena.json'), 'utf8')); const par = turf.polygon([JSON.parse(arena.perimetro)]);
  const classes = { mata: [], gramado: [], jardim: [] };
  area.forEach((e) => { const t = e.tags || {}; if (!e.geometry) return; const c = e.geometry.map((p) => [p.lon, p.lat]); if (c.length < 4 || c[0][0] !== c[c.length - 1][0]) return; let P; try { P = turf.polygon([c]); } catch (er) { return; }
    if (t.landuse === 'forest' || t.natural === 'wood') classes.mata.push(P); else if (t.landuse === 'grass') classes.gramado.push(P); else if (t.leisure === 'garden') classes.jardim.push(P); });
  console.log(slug, 'poligonos OSM:', Object.entries(classes).map(([k, v]) => k + '=' + v.length).join(' '));
  const [W, S, E, Nn] = turf.bbox(par); const [x0, y1] = tileDe(S, W), [x1, y0] = tileDe(Nn, E);
  const amostras = { mata: [], gramado: [], jardim: [], resto: [] };
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const img = await tile(x, y); const bb = (px, py) => { const i = (py * 256 + px) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
    for (let py = 4; py < 252; py += 4) for (let px = 4; px < 252; px += 4) {
      const [lng, lat] = pixLatLng(x, y, px, py); const pt = [lng, lat]; if (!turf.booleanPointInPolygon(pt, par)) continue;
      const [r, g, b] = bb(px, py); const br = (r + g + b) / 3; const verde = g / (r + g + b + 1);
      // textura: desvio do brilho numa janela 7x7 (copas de arvores = muita variacao; gramado = liso)
      let soma = 0, soma2 = 0, n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const q = bb(px + dx, py + dy); const v = (q[0] + q[1] + q[2]) / 3; soma += v; soma2 += v * v; n++; }
      const tex = Math.sqrt(Math.max(0, soma2 / n - (soma / n) ** 2));
      const amo = { br, verde, tex };
      const em = (k) => classes[k].some((P) => turf.booleanPointInPolygon(pt, P));
      if (em('mata')) amostras.mata.push(amo); else if (em('gramado')) amostras.gramado.push(amo); else if (em('jardim')) amostras.jardim.push(amo); else amostras.resto.push(amo);
    }
  }
  const pct = (a, p) => a.slice().sort((u, v) => u - v)[Math.floor(a.length * p)];
  const resumo = (arr, k) => arr.length ? `${Math.round(pct(arr.map((o) => o[k]), .1) * 10) / 10} | ${Math.round(pct(arr.map((o) => o[k]), .5) * 10) / 10} | ${Math.round(pct(arr.map((o) => o[k]), .9) * 10) / 10}` : '-';
  console.log('classe'.padEnd(10), 'amostras'.padStart(8), ' brilho p10|mediana|p90'.padEnd(28), 'textura p10|mediana|p90'.padEnd(26), 'verde p10|med|p90');
  Object.entries(amostras).forEach(([k, a]) => console.log(k.padEnd(10), String(a.length).padStart(8), (' ' + resumo(a, 'br')).padEnd(28), resumo(a, 'tex').padEnd(26), resumo(a, 'verde')));
  // separabilidade com acerto BALANCEADO (media do acerto em cada classe; 50% = cara ou coroa; evita o truque de chutar sempre a classe maior)
  const bal = (A, B, nomeB) => { if (A.length < 20 || B.length < 20) return; for (const k of ['br', 'tex']) {
    let melhor = { acc: 0 }; const valores = A.concat(B).map((o) => o[k]).sort((x, y) => x - y);
    for (let i = 5; i < valores.length - 5; i += Math.max(1, Math.floor(valores.length / 300))) { const th = valores[i];
      const mataMenor = k === 'br' ? (A.reduce((u, o) => u + o[k], 0) / A.length < B.reduce((u, o) => u + o[k], 0) / B.length) : (A.reduce((u, o) => u + o[k], 0) / A.length < B.reduce((u, o) => u + o[k], 0) / B.length);
      const tpr = A.filter((o) => (mataMenor ? o[k] < th : o[k] >= th)).length / A.length; const tnr = B.filter((o) => (mataMenor ? o[k] >= th : o[k] < th)).length / B.length; const acc = (tpr + tnr) / 2;
      if (acc > melhor.acc) melhor = { acc, th, tpr, tnr }; }
    console.log('  MATA x ' + nomeB + ' so por ' + (k === 'br' ? 'BRILHO' : 'TEXTURA') + ': acerto balanceado ' + Math.round(melhor.acc * 100) + '% (acerta ' + Math.round(melhor.tpr * 100) + '% das matas e ' + Math.round(melhor.tnr * 100) + '% do outro; limiar ' + Math.round(melhor.th) + ')'); } };
  bal(amostras.mata, amostras.gramado, 'GRAMADO'); bal(amostras.mata, amostras.resto, 'RESTO DO PARQUE');
})().catch((e) => { console.error(e.message); process.exit(1); });

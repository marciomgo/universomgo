// Procura no SATELITE (Esri World Imagery) o que o OpenStreetMap nao tem: quadras de areia/coloridas e telhados (construcoes).
// Uso: node detectar-satelite.js <slug> [pasta-para-imagens-de-conferencia]
// Grava parques/<slug>/satelite-candidatos.json = so o que o mapa NAO conhece (sao SUGESTOES, nao regra).
const turf = require('@turf/turf'); const fs = require('fs'); const path = require('path');
const { carregar, jpeg } = require('./satelite-util');
const slug = process.argv[2]; const IMG = process.argv[3];
const dir = path.join(__dirname, 'parques', slug);
const arena = JSON.parse(fs.readFileSync(path.join(dir, 'arena.json'), 'utf8'));
const parque = turf.polygon([JSON.parse(arena.perimetro)]);
const Z = 19, CEL = 4; // celula = 4x4 pixels = ~1 m
const regras = { // classificacao pela cor media da celula (calibrado no Germania)
  areia: (r, g, b) => r > 212 && g > 190 && b > 160 && r - b >= 22 && r - b <= 70 && r >= g && g >= b,
  telhaVermelha: (r, g, b) => r > 105 && r - g > 32 && r - b > 42 && g / r < 0.74,
  telhaBranca: (r, g, b) => r > 203 && g > 203 && b > 198 && Math.max(r, g, b) - Math.min(r, g, b) < 24,
  quadraAzul: (r, g, b) => b - r > 50 && b > 150 && g > 110 && b >= g
};
const tipoDe = { areia: 'quadra', quadraAzul: 'quadra', telhaVermelha: 'construcao', telhaBranca: 'construcao' };
const minM2 = { areia: 45, quadraAzul: 45, telhaVermelha: 14, telhaBranca: 14 };
const minFill = { areia: 0.78, quadraAzul: 0.78, telhaVermelha: 0.62, telhaBranca: 0.62 };
(async () => {
  const bb = turf.bbox(turf.buffer(parque, 30, { units: 'meters' }));
  const im = await carregar(bb, Z, 'esri');
  const gw = Math.floor(im.w / CEL), gh = Math.floor(im.h / CEL);
  const cor = new Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < CEL; dy++) for (let dx = 0; dx < CEL; dx++) { const i = ((gy * CEL + dy) * im.w + gx * CEL + dx) * 4; r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; }
    const n = CEL * CEL; cor[gy * gw + gx] = [r / n, g / n, b / n];
  }
  const m2Cel = turf.area(turf.polygon([[im.aGeo(0, 0), im.aGeo(CEL, 0), im.aGeo(CEL, CEL), im.aGeo(0, CEL), im.aGeo(0, 0)]]));
  const dil = (a) => { const o = new Uint8Array(a.length); for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { if (a[y * gw + x] || a[y * gw + x - 1] || a[y * gw + x + 1] || a[(y - 1) * gw + x] || a[(y + 1) * gw + x]) o[y * gw + x] = 1; } return o; };
  const ero = (a) => { const o = new Uint8Array(a.length); for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { if (a[y * gw + x] && a[y * gw + x - 1] && a[y * gw + x + 1] && a[(y - 1) * gw + x] && a[(y + 1) * gw + x]) o[y * gw + x] = 1; } return o; };
  const fechar = (m, rep) => { let a = m; for (let i = 0; i < rep; i++) a = dil(a); for (let i = 0; i < rep; i++) a = ero(a); return a; };
  const achados = [];
  for (const k of Object.keys(regras)) {
    let mask = new Uint8Array(gw * gh);
    for (let i = 0; i < mask.length; i++) { const c = cor[i]; if (regras[k](c[0], c[1], c[2])) mask[i] = 1; }
    mask = fechar(mask, (k === 'areia' || k === 'quadraAzul') ? 2 : 1);
    const vis = new Uint8Array(gw * gh);
    for (let s = 0; s < mask.length; s++) {
      if (!mask[s] || vis[s]) continue;
      const pil = [s]; vis[s] = 1; const cels = [];
      while (pil.length) {
        const p = pil.pop(); cels.push(p); const x = p % gw, y = (p / gw) | 0;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const q = ny * gw + nx; if (mask[q] && !vis[q]) { vis[q] = 1; pil.push(q); } }
      }
      const m2 = cels.length * m2Cel; if (m2 < minM2[k]) continue;
      let melhor = { fill: 0 }; // retangularidade: menor retangulo girado que contem a mancha
      for (let ang = 0; ang < 90; ang += 3) {
        const c = Math.cos(ang * Math.PI / 180), sn = Math.sin(ang * Math.PI / 180); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        cels.forEach((p) => { const x = p % gw, y = (p / gw) | 0; const u = x * c + y * sn, v = -x * sn + y * c; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; });
        const area = (x1 - x0 + 1) * (y1 - y0 + 1), fill = cels.length / area; if (fill > melhor.fill) melhor = { fill, x0, x1, y0, y1, c, sn };
      }
      if (melhor.fill < minFill[k]) continue;
      const { x0, x1, y0, y1, c, sn } = melhor;
      const larg = x1 - x0 + 1, alt = y1 - y0 + 1; if (k === 'telhaBranca' && Math.max(larg, alt) / Math.min(larg, alt) > 2.7) continue; // faixa comprida e clara = calcada/caminho de concreto, nao telhado
      const canto = (u, v) => { const x = u * c - v * sn, y = u * sn + v * c; return im.aGeo((x + 0.5) * CEL, (y + 0.5) * CEL); };
      const ring = [canto(x0 - .5, y0 - .5), canto(x1 + .5, y0 - .5), canto(x1 + .5, y1 + .5), canto(x0 - .5, y1 + .5)]; ring.push(ring[0]);
      const poli = turf.polygon([ring]); if (!turf.booleanIntersects(poli, parque)) continue;
      achados.push({ tipo: tipoDe[k], cor: k, m2: Math.round(m2), fill: Math.round(melhor.fill * 100) / 100, poli, ring });
    }
  }
  // o que o mapa (OpenStreetMap) ja conhece: quadras/parquinhos, construcoes, agua, areas restritas
  const conhecidos = [];
  (arena.zonasAuto || []).filter((z) => z.tipo !== 'satelite').forEach((z) => conhecidos.push({ nome: z.nome, tipo: 'quadra', p: turf.polygon([z.poligono]) }));
  (arena.zonasAutoLivres || []).forEach((z) => conhecidos.push({ nome: z.nome, tipo: 'quadra', p: turf.polygon([z.poligono]) }));
  (arena.construcoes || []).forEach((c) => conhecidos.push({ nome: 'construcao', tipo: 'construcao', p: turf.polygon([c]) }));
  ((arena.terreno || {}).restrito || []).forEach((c) => conhecidos.push({ nome: 'restrito', tipo: 'construcao', p: turf.polygon([c]) }));
  (arena.agua || []).forEach((c) => conhecidos.push({ nome: 'agua', tipo: 'agua', p: turf.polygon([c]) }));
  const cobre = (a, b) => { try { const i = turf.intersect(turf.featureCollection([a, b])); return i ? turf.area(i) / turf.area(a) : 0; } catch (e) { return 0; } };
  const novos = [], iguais = [];
  achados.forEach((a) => { const m = conhecidos.map((k) => ({ k, f: cobre(a.poli, k.p) })).sort((x, y) => y.f - x.f)[0]; if (m && m.f >= 0.35) iguais.push(Object.assign(a, { casa: m.k.nome })); else novos.push(a); });
  const naoVistos = conhecidos.filter((k) => k.tipo !== 'agua' && !achados.some((a) => cobre(a.poli, k.p) >= 0.35 || cobre(k.p, a.poli) >= 0.35));
  console.log(slug + ': satelite achou ' + achados.length + ' (' + iguais.length + ' o mapa ja tinha, ' + novos.length + ' NOVOS); mapa tem ' + conhecidos.filter((k) => k.tipo !== 'agua').length + ' e o satelite nao viu ' + naoVistos.length);
  novos.forEach((a) => { const c = turf.centroid(a.poli).geometry.coordinates; console.log('  NOVO ' + a.tipo + ' (' + a.cor + ') ' + a.m2 + ' m2 fill ' + a.fill + ' em ' + c[1].toFixed(5) + ',' + c[0].toFixed(5)); });
  fs.writeFileSync(path.join(dir, 'satelite-candidatos.json'), JSON.stringify({ gerado: 'deteccao automatica na foto de satelite Esri; sao SUGESTOES', novos: novos.map((a) => ({ tipo: a.tipo, cor: a.cor, m2: a.m2, poligono: a.ring.map((q) => [Math.round(q[0] * 1e7) / 1e7, Math.round(q[1] * 1e7) / 1e7]) })) }, null, 1));
  if (IMG) { // imagens de conferencia: amarelo = o mapa conhece; azul = o mapa conhece e o satelite nao viu; verde = os dois; rosa = SO o satelite
    const pinta = (ring, rgb) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const p0 = im.aPix(ring[i][1], ring[i][0]), p1 = im.aPix(ring[i + 1][1], ring[i + 1][0]); const n = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
        for (let t = 0; t <= n; t++) { const x = Math.round(p0[0] + (p1[0] - p0[0]) * t / n), y = Math.round(p0[1] + (p1[1] - p0[1]) * t / n);
          for (let d = -1; d <= 1; d++) for (let e = -1; e <= 1; e++) { const xx = x + d, yy = y + e; if (xx < 0 || yy < 0 || xx >= im.w || yy >= im.h) continue; const o = (yy * im.w + xx) * 4; im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; } }
      }
    };
    conhecidos.forEach((k) => pinta(k.p.geometry.coordinates[0], naoVistos.includes(k) ? [40, 120, 255] : [255, 255, 0]));
    iguais.forEach((a) => pinta(a.ring, [0, 255, 80])); novos.forEach((a) => pinta(a.ring, [255, 40, 220]));
    const n = 3, hh = Math.ceil(im.h / n);
    for (let k = 0; k < n; k++) { const y0 = k * hh, h = Math.min(hh, im.h - y0); fs.writeFileSync(path.join(IMG, slug + '-deteccao-' + k + '.jpg'), jpeg.encode({ data: Buffer.from(im.data.subarray(y0 * im.w * 4, (y0 + h) * im.w * 4)), width: im.w, height: h }, 85).data); }
  }
})().catch((e) => { console.error(e); process.exit(1); });

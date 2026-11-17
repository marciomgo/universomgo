// Área do jogo: ruas mais largas (em escala real) + perímetro permitido (linha vermelha, fora sombreado) + alerta ao sair.
// Parque/Casa: perímetro vem de DADOS.perimetro. Livre/dupla: círculo de 150 m em volta de onde o jogo começou.
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('function checarArea')) { console.log('modelo já tem a área'); }
else {
  const r = (a, b) => { if (m.split(a).length !== 2) throw new Error('falta ' + a.slice(0, 70)); m = m.replace(a, () => b); };
  // 1. ruas em escala real: metros -> pixels (14: 4,14 m/px; 19: 0,129 m/px; dobra a cada zoom)
  r(`var largura = ['interpolate', ['exponential', 1.6], ['zoom'], 14, 0.6, 19, 9];`,
`/* largura das ruas em escala real (metros por classe -> pixels a cada zoom; vale em torno de 30 graus de latitude) */
function larguraRua(extraM) {
  function porClasse(mpp) { var o = ['match', ['get', 'class']]; [['primary', 12], ['trunk', 12], ['secondary', 10], ['tertiary', 8], ['minor', 6], ['service', 4]].forEach(function (c) { o.push(c[0], (c[1] + extraM) / mpp); }); o.push((6 + extraM) / mpp); return o; }
  return ['interpolate', ['exponential', 2], ['zoom'], 14, porClasse(4.14), 19, porClasse(0.129)];
}
var largura = larguraRua(0);`);
  r(`'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 1.2, 19, 13] } },
    { id: 'rua',`, `'line-width': larguraRua(1.6) } },
    { id: 'rua',`);
  // 2. camadas do perímetro (logo depois das construções)
  r(`    // nuvem de zona do chefão`, `    // perímetro do jogo: fora da área fica sombreado de vermelho; a linha marca o limite
    { id: 'area-fora', type: 'fill', source: 'area-fora', paint: { 'fill-color': '#d32f2f', 'fill-opacity': 0.16 } },
    { id: 'area-linha-fundo', type: 'line', source: 'area-linha', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } },
    { id: 'area-linha', type: 'line', source: 'area-linha', layout: { 'line-join': 'round' }, paint: { 'line-color': '#e53935', 'line-width': 4.5 } },
    // nuvem de zona do chefão`);
  r(`ESTILO.sources['alcance-fill'] =`, `ESTILO.sources['area-fora'] = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
ESTILO.sources['area-linha'] = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
ESTILO.sources['alcance-fill'] =`);
  // 3. lógica
  r(`function spawnAoRedor(lat, lng) {
`, `// ---------- área do jogo (perímetro) ----------
var AREA = null, RAIO_AREA_LIVRE_M = 150, foraDaArea = false; // AREA = { anel: [[lng,lat],...] } ou { lat, lng, raio }
function anelDaArea() { return AREA.anel || circulo(AREA.lat, AREA.lng, AREA.raio, 120); }
function pintarArea() {
  if (!AREA) return;
  quandoMapaPronto(function () {
    var anel = anelDaArea(), mundo = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    mapa.getSource('area-fora').setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [mundo, anel] } });
    mapa.getSource('area-linha').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: anel } });
  });
}
function definirAreaLivre(lat, lng) { // modo livre/dupla: círculo de 150 m em volta de onde o jogo começa
  if (AREA && AREA.raio && Math.abs(AREA.lat - lat) < 1e-7 && Math.abs(AREA.lng - lng) < 1e-7) return;
  AREA = { lat: lat, lng: lng, raio: RAIO_AREA_LIVRE_M }; pintarArea();
}
function dentroDaArea(lat, lng) {
  if (!AREA) return true;
  if (AREA.raio) return Math.hypot((lat - AREA.lat) * 111320, (lng - AREA.lng) * 111320 * Math.cos(AREA.lat * rad)) <= AREA.raio;
  var a = AREA.anel, dentro = false;
  for (var i = 0, j = a.length - 1; i < a.length; j = i++) { if (((a[i][1] > lat) !== (a[j][1] > lat)) && (lng < (a[j][0] - a[i][0]) * (lat - a[i][1]) / (a[j][1] - a[i][1]) + a[i][0])) dentro = !dentro; }
  return dentro;
}
function checarArea() {
  var fora = !dentroDaArea(POS.lat, POS.lng);
  if (fora === foraDaArea) return;
  foraDaArea = fora; document.body.classList.toggle('fora-area', fora);
  if (fora && navigator.vibrate) navigator.vibrate([120, 80, 120]);
}
if (DADOS.perimetro) { AREA = { anel: DADOS.perimetro }; pintarArea(); }
function spawnAoRedor(lat, lng) {
  if (DADOS.livre) definirAreaLivre(lat, lng);
`);
  r(`  if (++contaQuadro % 3 === 0) atualizarAlcance();`, `  if (++contaQuadro % 3 === 0) atualizarAlcance();
  if (contaQuadro % 6 === 0) checarArea();`);
  r(`<div id="pausaSat">`, `<div id="foraArea">⚠ Área proibida! Volte para a área do jogo</div><div id="pausaSat">`);
  r(`  #pausaSat{`, `  #foraArea{display:none;position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:6;background:rgba(198,40,40,.94);color:#fff;border:2px solid #fff;border-radius:14px;padding:8px 14px;font-size:14px;font-weight:bold;text-align:center;max-width:86%;box-shadow:0 3px 10px rgba(0,0,0,.45);pointer-events:none;animation:piscaArea 1.1s ease-in-out infinite}
  body.fora-area #foraArea{display:block}
  @keyframes piscaArea{0%,100%{opacity:1}50%{opacity:.72}}
  #pausaSat{`);
  fs.writeFileSync(__dirname + '/proto-modelo.html', m);
  console.log('modelo ok');
}
// 4. gerar-proto.js: o perímetro do parque e da casa vai nos dados
let g = fs.readFileSync(__dirname + '/gerar-proto.js', 'utf8');
if (!g.includes('perimetro:')) {
  g = g.replace('    largada: L,\n    pontos: dentro(d.pontos', '    largada: L, perimetro: d.perimetro,\n    pontos: dentro(d.pontos');
  g = g.replace('    largada: L,\n    pontos: bases.map', '    largada: L, perimetro: c.perimetro,\n    pontos: bases.map');
  fs.writeFileSync(__dirname + '/gerar-proto.js', g); console.log('gerar-proto ok', g.includes('perimetro:'));
}
// 5. dupla: o anfitrião manda o centro da área aos convidados
let d = fs.readFileSync(__dirname + '/editar-dupla.js', 'utf8');
if (!d.includes('definirAreaLivre')) {
  const a1 = "return { t: 'estado', r: rodada, js: js,", b1 = "return { t: 'estado', r: rodada, ar: (AREA && AREA.raio) ? [AREA.lat, AREA.lng] : null, js: js,";
  const a2 = "  net.ultimoJs = m.js || [];", b2 = "  if (m.ar) definirAreaLivre(m.ar[0], m.ar[1]);\n  net.ultimoJs = m.js || [];";
  if (d.split(a1).length !== 2 || d.split(a2).length !== 2) throw new Error('dupla');
  d = d.replace(a1, () => b1).replace(a2, () => b2); fs.writeFileSync(__dirname + '/editar-dupla.js', d); console.log('dupla ok');
}

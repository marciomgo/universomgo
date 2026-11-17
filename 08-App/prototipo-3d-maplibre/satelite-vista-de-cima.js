// Satélite = "mapa de cima": ao ligar, a câmera vai pra vista de cima (inclinação 0) e se afasta pro nível em que a foto tem a melhor
// qualidade (nível 19 da foto = zoom 18 aqui); ao desligar, volta à inclinação e ao zoom de antes. O jogo continua rodando. (idempotente)
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('ZOOM_SATELITE')) { console.log('já aplicado'); process.exit(0); }
const r = (a, b) => { if (!m.includes(a)) throw new Error('falta: ' + a.slice(0, 80)); m = m.replace(a, () => b); };

r("document.getElementById('bSat').onclick = function () { satelite = !satelite; aplicarSatelite(); };",
`var ZOOM_SATELITE = 18, antesSat = null;
document.getElementById('bSat').onclick = function () {
  satelite = !satelite; aplicarSatelite();
  document.getElementById('bSat').classList.toggle('ligado', satelite);
  if (satelite) { antesSat = { inc: inclinacao, zoom: zoom }; inclinacao = 0; zoom = ZOOM_SATELITE; } // de cima e no melhor nível da foto
  else if (antesSat) { inclinacao = antesSat.inc; zoom = antesSat.zoom; antesSat = null; }
  pintaInc();
};`);
r("document.getElementById('bMais').onclick = function () { zoom = Math.min(21, zoom + 0.4); };", "document.getElementById('bMais').onclick = function () { zoom = Math.min(satelite ? 18.4 : 21, zoom + 0.4); };");
r("document.getElementById('bMenos').onclick = function () { zoom = Math.max(17, zoom - 0.4); };", "document.getElementById('bMenos').onclick = function () { zoom = Math.max(satelite ? 16 : 17, zoom - 0.4); };");
r("document.getElementById('bInc').onclick = function () { nivelInc", "document.getElementById('bInc').onclick = function () { if (satelite) return; /* no mapa de cima a inclinação fica em 0 */ nivelInc");
// transição suave da câmera (inclinação e zoom) em vez de pular
r("  var pitchEf = Math.min(80, inclinacao + BATALHA_MAIS_INC * fBat);\n  var zoomEf = zoom + ZOOM_BATALHA_EXTRA * fBat;",
"  var pitchAlvo = Math.min(80, inclinacao + BATALHA_MAIS_INC * fBat), zoomAlvo = zoom + ZOOM_BATALHA_EXTRA * fBat;\n  if (pitchSuave === undefined) { pitchSuave = pitchAlvo; zoomSuave = zoomAlvo; }\n  var kc = 1 - Math.exp(-5 * dt); pitchSuave += (pitchAlvo - pitchSuave) * kc; zoomSuave += (zoomAlvo - zoomSuave) * kc;\n  if (Math.abs(pitchAlvo - pitchSuave) < 0.05) pitchSuave = pitchAlvo; if (Math.abs(zoomAlvo - zoomSuave) < 0.005) zoomSuave = zoomAlvo;\n  var pitchEf = pitchSuave, zoomEf = zoomSuave;");
r("var heading = 30, bearing = 30,", "var pitchSuave, zoomSuave; // câmera suavizada\nvar heading = 30, bearing = 30,");
r('</style>', "  #painel button.ligado{background:#ffd54f !important;box-shadow:0 0 0 3px #fff, 0 2px 6px rgba(0,0,0,.4)}\n</style>");
fs.writeFileSync(__dirname + '/proto-modelo.html', m);
console.log('satélite vira vista de cima');

// Acrescenta a animação de CAMINHAR (3 imagens: direita à frente, neutra, esquerda à frente) ao editar-dupla.js.
// Roda UMA vez (é idempotente: se já estiver aplicado, não faz nada).
const fs = require('fs');
const arq = __dirname + '/editar-dupla.js';
let s = fs.readFileSync(arq, 'utf8');
if (s.includes('FRAME_ANDAR')) { console.log('já aplicado'); process.exit(0); }
const r = (a, b) => { if (!s.includes(a)) throw new Error('falta: ' + a.slice(0, 90)); s = s.replace(a, () => b); };

// 1. ganchos no modelo (viram etapa nova dentro do editar-dupla.js)
const etapa = `
// ---------- 8. caminhar: imagens de passada (direita à frente, neutra, esquerda à frente) ----------
r('<div class="corpo" id="corpoEst" style="display:none"><img id="imgEst" alt=""></div>', '<div class="corpo" id="corpoEst" style="display:none"><img id="imgEst" alt=""></div><div class="corpo" id="corpoAndar" style="display:none"><img id="imgAndar" alt=""></div>');
r("  posicionarQuadro(FRAME_EST, 'imgEst', 'corpoEst', sy, hVis);", "  posicionarQuadro(FRAME_EST, 'imgEst', 'corpoEst', sy, hVis);\\n  posicionarQuadro(FRAME_ANDAR, 'imgAndar', 'corpoAndar', sy, hVis);");
r('#mineu.comPau .corpo:not(#corpoGolpe):not(#corpoEst) img{visibility:hidden}', '#mineu.comPau .corpo:not(#corpoGolpe):not(#corpoEst):not(#corpoAndar) img{visibility:hidden}\\n  #mineu.andandoF .corpo{display:none !important}\\n  #mineu.andandoF #corpoAndar{display:block !important}\\n  #mineu.andandoF #galhoMineu{display:none !important}');
r("  elMineu.classList.toggle('anda', andando);", "  elMineu.classList.toggle('anda', andando);\\n  atualizarAndar(agora);");
r('function posicionarQuadro(', \`var FRAME_ANDAR = { w: 178, h: 524, ax: 92.35, ay: 520, src: ['mineu-andar-1.png', 'mineu-andar-2.png', 'mineu-andar-3.png'], prontos: 0 };
FRAME_ANDAR.src.forEach(function (u) { var im = new Image(); im.onload = function () { FRAME_ANDAR.prontos++; }; im.src = u; });
var SEQ_ANDAR = [0, 1, 2, 1]; // direita à frente, neutra, esquerda à frente, neutra
var atacandoAte = 0, andandoF = false, idxAndarVisto = -1, rastroEu = { p: [] };
function velRastro(r, lat, lng, t) { // velocidade (m/s) pelo deslocamento nos últimos 1,5 s: tira o balanço do GPS parado
  r.p.push([t, lat, lng]); while (r.p.length > 2 && t - r.p[0][0] > 1500) r.p.shift();
  var a = r.p[0], dt = (t - a[0]) / 1000; if (dt < 0.4) return r.v || 0;
  var dl = (lat - a[1]) * 111320, dn = (lng - a[2]) * 111320 * Math.cos(lat * rad);
  r.v = Math.sqrt(dl * dl + dn * dn) / dt; r.mov = r.mov ? r.v > 0.35 : r.v > 0.6; return r.v;
}
function msPassada(v) { return Math.max(140, Math.min(350, 300 / Math.max(v, 0.3))); } // mais rápido a pé, passada mais rápida
function atualizarAndar(agora) {
  var v = velRastro(rastroEu, POS.lat, POS.lng, agora);
  var quer = !!rastroEu.mov && FRAME_ANDAR.prontos >= 3 && agora > atacandoAte;
  if (quer !== andandoF) { andandoF = quer; elMineu.classList.toggle('andandoF', quer); idxAndarVisto = -1; }
  if (quer) { var idx = SEQ_ANDAR[Math.floor(agora / msPassada(v)) % 4]; if (idx !== idxAndarVisto) { idxAndarVisto = idx; document.getElementById('imgAndar').src = FRAME_ANDAR.src[idx]; } }
}
function posicionarQuadro(\`);
`;
s = s.replace('// ---------- 7. o bloco de rede ----------', () => etapa + '\n// ---------- 7. o bloco de rede ----------');

// 2. ataques marcam o instante, pra caminhar não atropelar a pose de ataque
r("  net.enviar({ t: 'atq', p: net.pid, k: tipo, de:", "  atacandoAte = performance.now() + 450; net.enviar({ t: 'atq', p: net.pid, k: tipo, de:");
r("  net.enviar({ t: 'atq', p: net.pid, k: 'pau' });", "  atacandoAte = performance.now() + 450; net.enviar({ t: 'atq', p: net.pid, k: 'pau' });");

// 3. os outros jogadores também caminham
r("  var F = conj === 'p' ? FRAME_GOLPE : FRAME_EST, img = j.el.querySelector('img'), cg = 0.3631, e = 0.5;", "  var F = conj === 'p' ? FRAME_GOLPE : (conj === 'a' ? FRAME_ANDAR : FRAME_EST), img = j.el.querySelector('img'), cg = 0.3631, e = 0.5;");
r("  if (!j.el || j.anim) return;\n  var conj = j.arma", "  if (!j.el || j.anim || j.andando) return;\n  var conj = j.arma");
r("    j.el.querySelector('.vida i').style.width = Math.max(0, j.vida) + '%';\n    poseDoOutro(j);", `    j.el.querySelector('.vida i').style.width = Math.max(0, j.vida) + '%';
    var agoraMs = performance.now(), vj = velRastro(j.rastro || (j.rastro = { p: [] }), j.lat, j.lng, agoraMs);
    if (j.rastro.mov && !j.anim && FRAME_ANDAR.prontos >= 3) { // o amigo está andando: passada
      j.andando = true; var ix = SEQ_ANDAR[Math.floor(agoraMs / msPassada(vj)) % 4];
      if (ix !== j.idxA) { j.idxA = ix; pintarAvatar(j, 'a', ix); }
    } else if (j.andando) { j.andando = false; j.conjVisto = null; j.idxA = -1; }
    poseDoOutro(j);`);
fs.writeFileSync(arq, s);
console.log('andar acrescentado ao editar-dupla.js');

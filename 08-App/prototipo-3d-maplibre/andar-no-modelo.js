// Passa a animação de CAMINHAR do editar-dupla.js pro MODELO BASE (proto-modelo.html): caminhar é genérico, vale pra todas as páginas.
// Roda uma vez (idempotente). Depois: node gerar-proto.js  e  node editar-dupla.js && node gerar-dupla.js
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('FRAME_ANDAR')) { console.log('modelo já tem a caminhada'); process.exit(0); }
const r = (a, b) => { if (!m.includes(a)) throw new Error('modelo: falta ' + a.slice(0, 90)); m = m.replace(a, () => b); };

r('<div class="corpo" id="corpoEst" style="display:none"><img id="imgEst" alt=""></div>', '<div class="corpo" id="corpoEst" style="display:none"><img id="imgEst" alt=""></div><div class="corpo" id="corpoAndar" style="display:none"><img id="imgAndar" alt=""></div>');
r("  posicionarQuadro(FRAME_EST, 'imgEst', 'corpoEst', sy, hVis);", "  posicionarQuadro(FRAME_EST, 'imgEst', 'corpoEst', sy, hVis);\n  posicionarQuadro(FRAME_ANDAR, 'imgAndar', 'corpoAndar', sy, hVis);");
r('#mineu.comPau .corpo:not(#corpoGolpe):not(#corpoEst) img{visibility:hidden}', '#mineu.comPau .corpo:not(#corpoGolpe):not(#corpoEst):not(#corpoAndar) img{visibility:hidden}\n  #mineu.andandoF .corpo{display:none !important}\n  #mineu.andandoF #corpoAndar{display:block !important}\n  #mineu.andandoF #galhoMineu{display:none !important}');
r("  elMineu.classList.toggle('anda', andando);", "  elMineu.classList.toggle('anda', andando);\n  atualizarAndar(agora);");
r('function posicionarQuadro(', `var FRAME_ANDAR = { w: 178, h: 524, ax: 92.35, ay: 520, src: ['mineu-andar-1.png', 'mineu-andar-2.png', 'mineu-andar-3.png'], prontos: 0 };
FRAME_ANDAR.src.forEach(function (u) { var im = new Image(); im.onload = function () { FRAME_ANDAR.prontos++; }; im.src = u; });
var SEQ_ANDAR = [0, 1, 2, 1]; // direita à frente, neutra, esquerda à frente, neutra
var atacandoAte = 0, andandoF = false, idxAndarVisto = -1, rastroEu = { p: [] };
function velRastro(r, lat, lng, t) { // velocidade (m/s) pelo deslocamento nos últimos 1,5 s: tira o balanço do GPS parado
  r.p.push([t, lat, lng]); while (r.p.length > 2 && t - r.p[0][0] > 1500) r.p.shift();
  var a = r.p[0], dt = (t - a[0]) / 1000; if (dt < 0.4) return r.v || 0;
  var dl = (lat - a[1]) * 111320, dn = (lng - a[2]) * 111320 * Math.cos(lat * rad);
  r.v = Math.sqrt(dl * dl + dn * dn) / dt; r.mov = r.mov ? r.v > 0.35 : r.v > 0.6; return r.v;
}
function idxPassada(r, agora, v) { // fase acumulada: trocar a velocidade não embaralha a ordem das imagens
  var dt = r.tp ? agora - r.tp : 0; if (dt > 300) dt = 0; r.tp = agora; r.fase = (r.fase || 0) + dt / msPassada(v);
  return SEQ_ANDAR[Math.floor(r.fase) % 4];
}
function msPassada(v) { return Math.max(140, Math.min(350, 300 / Math.max(v, 0.3))); } // mais rápido a pé, passada mais rápida
function atualizarAndar(agora) {
  var v = velRastro(rastroEu, POS.lat, POS.lng, agora);
  var quer = !!rastroEu.mov && FRAME_ANDAR.prontos >= 3 && agora > atacandoAte;
  if (quer !== andandoF) { andandoF = quer; elMineu.classList.toggle('andandoF', quer); idxAndarVisto = -1; }
  if (quer) { var idx = idxPassada(rastroEu, agora, v); if (idx !== idxAndarVisto) { idxAndarVisto = idx; document.getElementById('imgAndar').src = FRAME_ANDAR.src[idx]; } }
}
function posicionarQuadro(`);
// ataque: pose de ataque passa por cima da passada
r("  municao[ativa]--; pintaMunicao();", "  municao[ativa]--; pintaMunicao(); atacandoAte = performance.now() + 450;");
r("  var agora = performance.now(); if (agora - ultimoGolpe < GALHO_PAUSA) return; ultimoGolpe = agora;", "  var agora = performance.now(); if (agora - ultimoGolpe < GALHO_PAUSA) return; ultimoGolpe = agora; atacandoAte = agora + 450;");
fs.writeFileSync(__dirname + '/proto-modelo.html', m);

// ---- tira a etapa duplicada do editar-dupla.js (agora vem do modelo); mantém só a parte dos amigos ----
let d = fs.readFileSync(__dirname + '/editar-dupla.js', 'utf8');
const i0 = d.indexOf('\n// ---------- 8. caminhar'), i1 = d.indexOf('\n// ---------- 7. o bloco de rede ----------');
if (i0 >= 0 && i1 > i0) d = d.slice(0, i0) + d.slice(i1);
d = d.split('atacandoAte = performance.now() + 450; ').join('');
// os amigos andam: o que sobrou da etapa 8 era só o gancho no modelo; a parte dos amigos mora no bloco de rede
fs.writeFileSync(__dirname + '/editar-dupla.js', d);
console.log('caminhada passou pro modelo; editar-dupla.js limpo');

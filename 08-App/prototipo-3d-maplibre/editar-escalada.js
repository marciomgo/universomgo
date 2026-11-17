// PROTÓTIPO "mundo escondido": uma rocha gigante no Parcão que só dá pra subir com a habilidade de escalada; em cima, uma SARABATANA (arma nova).
// Cópia do modelo (não mexe no modelo base nem nas páginas prontas): proto-modelo.html -> proto-escalada.html. Depois: node gerar-escalada.js
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
const r = (a, b) => { if (s.split(a).length !== 2) throw new Error('falta (ou repetido): ' + a.slice(0, 90)); s = s.replace(a, () => b); };

// ---------- 1. a arma nova ('sar'): alcance maior, dardo, cadência mais rápida ----------
r("var ALCANCE_TIRO_M = 35, CONE_GRAUS = 10, DANO = { normal: 5, esp: 10 };",
  "var ALCANCE_TIRO_M = 35, CONE_GRAUS = 10, DANO = { normal: 5, esp: 10, sar: 5 };\nfunction alcanceArma() { return ativa === 'sar' ? 55 : ALCANCE_TIRO_M; } /* a sarabatana alcança mais longe */");
// o alcance da MIRA e do tiro passa a depender da arma (o raio de aggro dos monstros não muda)
s = s.split('\n').map((ln) => (ln.includes('ALCANCE_TIRO_M') && !/^var (ALCANCE_TIRO_M|ZUMBI_VEL|CHEFAO_PARA_LIVRE_M)/.test(ln) && !ln.startsWith('function alcanceArma')) ? ln.split('ALCANCE_TIRO_M').join('alcanceArma()') : ln).join('\n');
r("el.className = 'pedrada' + (tipo === 'esp' ? ' esp' : ''); el.innerHTML = tipo === 'esp' ? '<span class=\"pe-amarela\">🪨</span>' : '🪨'; fora.appendChild(el);",
  "el.className = 'pedrada' + (tipo === 'esp' ? ' esp' : '') + (tipo === 'sar' ? ' dardo' : ''); el.innerHTML = tipo === 'sar' ? '➤' : (tipo === 'esp' ? '<span class=\"pe-amarela\">🪨</span>' : '🪨'); fora.appendChild(el);");
r("rotate(' + (t * 1100) + 'deg)';", "rotate(' + (tipo === 'sar' ? 0 : t * 1100) + 'deg)';");
r("if (agoraT - ultimoTiro < TIRO_PAUSA_MS) return;", "if (agoraT - ultimoTiro < (ativa === 'sar' ? 250 : TIRO_PAUSA_MS)) return;");
r("function iconeArma(k) { return k === \"galho\" ? ICONE_PAU :", "function iconeArma(k) { return k === 'sar' ? SAR_SVG : k === \"galho\" ? ICONE_PAU :");
r("document.getElementById(\"btnAtirar\").innerHTML = ativa === \"galho\" ? ICONE_PAU : ESTILINGUE_HTML;", "document.getElementById(\"btnAtirar\").innerHTML = ativa === \"galho\" ? ICONE_PAU : (ativa === 'sar' ? SAR_GRANDE : ESTILINGUE_HTML);");
r("municao.esp = 24; vidaMineu = 100;", "municao.esp = 24; if (temSar) municao.sar = 60; vidaMineu = 100;");

// ---------- 2. quem está no alto da rocha não leva dano nem age ----------
s = s.split('if (satelite) return;').join('if (satelite || emAlto) return;');
r("function mordida(agora) {\n  ultimaMordida = agora;", "function mordida(agora) {\n  if (emAlto) return;\n  ultimaMordida = agora;");
r("function levarDano(v) {\n  vidaMineu -= v;", "function levarDano(v) {\n  if (emAlto) return;\n  vidaMineu -= v;");

// ---------- 3. visual e tela ----------
r("  #nivelTag{", `  .pedrada.dardo{font-size:22px;color:#3e2a14;text-shadow:0 0 3px #fff}
  .rocha{width:2px;height:2px;pointer-events:none}
  .rochaTag{position:absolute;left:50%;top:-200px;transform:translateX(-50%);white-space:nowrap;background:rgba(30,40,50,.88);color:#fff;font-size:11px;font-weight:bold;padding:3px 9px;border-radius:999px}
  #bSubir{display:none;position:absolute;left:50%;bottom:132px;transform:translateX(-50%);z-index:7;border:3px solid #fff;border-radius:999px;background:#ef6c00;color:#fff;font-size:18px;font-weight:bold;padding:12px 22px;box-shadow:0 4px 12px rgba(0,0,0,.45);cursor:pointer;touch-action:manipulation}
  #subindo{display:none;position:absolute;left:50%;top:34%;transform:translateX(-50%);z-index:7;flex-direction:column;align-items:center;gap:8px;background:rgba(30,40,50,.82);color:#fff;border-radius:16px;padding:12px 20px;font-size:16px;font-weight:bold}
  #subindo .barraS{width:180px;height:10px;border-radius:6px;background:rgba(255,255,255,.25);overflow:hidden}
  #subindo .barraS i{display:block;height:100%;width:0;background:#ffca28}
  #premio{display:none;position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.55);align-items:center;justify-content:center}
  #premio .caixaP2{background:#fff8e1;border:4px solid #ffb300;border-radius:20px;padding:22px 24px;max-width:320px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5)}
  #premio h2{margin:8px 0 6px;font-size:22px;color:#5d3a00}
  #premio p{margin:0 0 14px;font-size:14px;color:#4e3b1f}
  #premio button{border:0;border-radius:999px;background:#ef6c00;color:#fff;font-size:17px;font-weight:bold;padding:11px 24px;cursor:pointer}
  #bInsig.ligado{background:#ffd54f !important;box-shadow:0 0 0 3px #fff, 0 2px 6px rgba(0,0,0,.4)}
  #nivelTag{`);
r('<div id="nivelTag" style="display:none"></div>', '<div id="bSubirBox"></div><button id="bSubir">🧗 Subir na rocha</button><div id="subindo"><span>🧗 Escalando…</span><div class="barraS"><i></i></div></div><div id="premio"><div class="caixaP2"><div id="premioIcone"></div><h2>Você pegou a SARABATANA!</h2><p>Dardos rápidos que alcançam mais longe. Ela agora está no seu arsenal, é só trocar de arma.</p><button id="bDescer">Descer com a sarabatana</button></div></div><div id="nivelTag" style="display:none"></div>');

// ---------- 3b. teste de casa: sem GPS, anda com um joystick na tela ----------
r("document.getElementById('bInicio').onclick = function () {\n  jogoIniciado = true;\n  document.getElementById('inicio').style.display = 'none';\n  document.getElementById('bGps').click(); // liga GPS e bússola (precisa ser dentro do toque)\n};",
  "document.getElementById('bInicio').onclick = function () { /* teste de casa: sem GPS, anda com o joystick */\n  jogoIniciado = true;\n  document.getElementById('inicio').style.display = 'none';\n};");
r('<div id="bSubirBox"></div>', '<div id="joy"><div id="joyBola"></div></div><div id="bSubirBox"></div>');
r('  #bSubir{display:none;', '  #joy{position:absolute;left:14px;bottom:26px;width:104px;height:104px;border-radius:50%;background:rgba(255,255,255,.3);border:3px solid rgba(255,255,255,.75);z-index:6;touch-action:none;user-select:none;-webkit-user-select:none}\n  #joyBola{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:0 2px 6px rgba(0,0,0,.45);pointer-events:none}\n  #bSubir{display:none;');
const joystick = fs.readFileSync(__dirname + '/escalada-joystick.js.txt', 'utf8');

// ---------- 4. a lógica do mundo escondido ----------
const fim = s.lastIndexOf('// ---------- jogar sem internet ----------');
if (fim < 0) throw new Error('marca offline');
const logica = `// ---------- MUNDO ESCONDIDO: a rocha que só aparece pra quem sabe escalar ----------
/* Requisito do objeto: DADOS.rocha.req = 'escalada'. Sem a insígnia a rocha fica uma silhueta apagada com o aviso do que falta; com ela dá pra subir e pegar a sarabatana (que fica pra sempre no arsenal). */
var SAR_SVG = '<svg viewBox="0 0 64 24" width="34" height="13" style="transform:rotate(-16deg)"><rect x="2" y="9" width="48" height="6" rx="3" fill="#8d5a2b" stroke="#4a2c12" stroke-width="1.5"/><rect x="46" y="7.5" width="15" height="9" rx="3" fill="#d9b573" stroke="#4a2c12" stroke-width="1.5"/><path d="M8 11 L40 11" stroke="#b98450" stroke-width="1.4" stroke-linecap="round"/></svg>';
var SAR_GRANDE = '<svg viewBox="0 0 64 24" width="46" height="18" style="transform:rotate(-16deg)"><rect x="2" y="9" width="48" height="6" rx="3" fill="#8d5a2b" stroke="#4a2c12" stroke-width="1.5"/><rect x="46" y="7.5" width="15" height="9" rx="3" fill="#d9b573" stroke="#4a2c12" stroke-width="1.5"/><path d="M8 11 L40 11" stroke="#b98450" stroke-width="1.4" stroke-linecap="round"/></svg>';
var ROCHA_SVG = '<svg class="rochaImg" viewBox="0 0 130 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gRoc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9bec4"/><stop offset="1" stop-color="#6c7279"/></linearGradient></defs><polygon points="4,98 12,66 28,44 46,30 60,14 86,12 100,28 118,52 128,98" fill="url(#gRoc)" stroke="#43484e" stroke-width="2.5" stroke-linejoin="round"/><path d="M60 14 L64 40 L52 62 M86 12 L82 36 L96 60 M28 44 L44 58 L40 86 M118 52 L102 66" fill="none" stroke="#4c5258" stroke-width="2" stroke-linecap="round"/><path d="M20 70 L46 64 M72 52 L98 56 M30 90 L62 84 M80 88 L112 82" fill="none" stroke="#e8ecef" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M58 14 L88 12 L86 20 L60 22 Z" fill="#7cb342" opacity=".8"/></svg>';
var INSIG = { escalada: false }, temSar = false, emAlto = false, elRocha = null;
try { INSIG.escalada = localStorage.getItem('mgo-insignia-escalada') === '1'; temSar = localStorage.getItem('mgo-sarabatana') === '1'; } catch (e) {}
if (/[?&]zerar=1/.test(location.search)) { temSar = false; INSIG.escalada = false; try { localStorage.removeItem('mgo-sarabatana'); localStorage.removeItem('mgo-insignia-escalada'); } catch (e) {} }
if (/[?&]insignia=escalada/.test(location.search)) INSIG.escalada = true;
function pintarRocha() {
  if (!elRocha) return;
  elRocha.classList.toggle('trancada', !INSIG.escalada); elRocha.classList.toggle('vazia', temSar);
  elRocha.querySelector('.rochaTag').textContent = !INSIG.escalada ? '🔒 Precisa da habilidade de escalada' : (temSar ? '✔ Rocha escalada' : '🧗 Chegue perto pra subir');
  var b = document.getElementById('bInsig'); if (b) b.classList.toggle('ligado', INSIG.escalada);
  atualizarRocha3D();
  elRocha.querySelector('.rochaTag').style.top = (-alturaTopoPx() - 30) + 'px'; /* o aviso fica em cima do topo da rocha */
}
function darSarabatana(novo) {
  temSar = true; if (ORDEM_ARMAS.indexOf('sar') < 0) ORDEM_ARMAS.push('sar'); municao.sar = 60;
  if (novo) { ativa = 'sar'; try { localStorage.setItem('mgo-sarabatana', '1'); } catch (e) {} }
  pintaMunicao(); pintarRocha();
}
if (temSar) darSarabatana(false);
function criarElRocha(lat, lng) {
  if (elRocha) { elRocha._mk.setLngLat([lng, lat]); elRocha._ll = [lng, lat]; return; }
  elRocha = marcador(lat, lng, 'rocha', '<div class="rochaTag"></div>', 'bottom');
  pintarRocha();
}
mapa.on('load', function () { var r = DADOS.rocha; if (r) criarElRocha(r.lat, r.lng); });
/* modo livre: a rocha nasce a ~26 m de onde o jogo começa (e muda de lugar a cada rodada nova) */
var spawnBaseEsc = spawnBase;
spawnBase = function (lat, lng) {
  spawnBaseEsc(lat, lng);
  if (!DADOS.livre) return;
  var p = pontoLivre(lat, lng, 26, 100); DADOS.rocha = { lat: p.lat, lng: p.lng, req: 'escalada' }; criarElRocha(p.lat, p.lng);
};
var bIns = document.createElement('button'); bIns.id = 'bInsig'; bIns.title = 'Teste: liga/desliga a habilidade de escalada'; bIns.textContent = '🧗';
document.getElementById('painel').appendChild(bIns);
bIns.onclick = function () {
  INSIG.escalada = !INSIG.escalada; try { localStorage.setItem('mgo-insignia-escalada', INSIG.escalada ? '1' : '0'); } catch (e) {}
  pintarRocha(); aviso(INSIG.escalada ? 'Teste: habilidade de escalada LIGADA' : 'Teste: habilidade de escalada DESLIGADA'); setTimeout(function () { aviso(''); }, 2500);
};
var avisouRocha = 0;
setInterval(function () {
  var r = DADOS.rocha; if (!r) return;
  var d = metrosAte(r.lat, r.lng).d, perto = d <= 9 && !emAlto, b = document.getElementById('bSubir');
  b.style.display = (perto && INSIG.escalada && !temSar) ? 'block' : 'none';
  if (perto && !INSIG.escalada && performance.now() - avisouRocha > 10000) { avisouRocha = performance.now(); aviso('Você ainda não sabe escalar. Precisa da habilidade de escalada (aula com um parceiro).'); setTimeout(function () { aviso(''); }, 4500); }
  pintarRocha();
}, 300);
function subirDescer(de, para, ms, fim) {
  var t0 = performance.now();
  (function passo(agora) { var t = Math.min(1, (agora - t0) / ms); elMineu.style.marginTop = (-(de + (para - de) * t)) + 'px'; if (t < 1) { requestAnimationFrame(passo); return; } if (fim) fim(); })(t0);
}
document.getElementById('bSubir').onclick = function () {
  if (emAlto || temSar || !INSIG.escalada) return;
  emAlto = true; this.style.display = 'none'; altoSubida = alturaTopoPx();
  var caixa = document.getElementById('subindo'), barra = caixa.querySelector('i'), t0 = performance.now(), DUR = 3600;
  caixa.style.display = 'flex'; barra.style.width = '0';
  [0, 500, 1000, 1500, 2000, 2500, 3000].forEach(function (ms, k) { setTimeout(function () { tocarTom(300 + k * 70, 340 + k * 70, 120, 'triangle', 0.12); }, ms); });
  (function passo(agora) {
    var t = Math.min(1, (agora - t0) / DUR); elMineu.style.marginTop = (-altoSubida * t) + 'px'; barra.style.width = (t * 100) + '%';
    if (t < 1) { requestAnimationFrame(passo); return; }
    caixa.style.display = 'none';
    document.getElementById('premioIcone').innerHTML = SAR_GRANDE.replace('width="46" height="18"', 'width="120" height="45"');
    document.getElementById('premio').style.display = 'flex';
    [[523, 0], [659, 150], [784, 300], [1047, 450]].forEach(function (n) { setTimeout(function () { tocarTom(n[0], n[0], 220, 'square', 0.1); }, n[1]); });
  })(t0);
};
document.getElementById('bDescer').onclick = function () {
  document.getElementById('premio').style.display = 'none';
  darSarabatana(true);
  subirDescer(altoSubida, 0, 900, function () { emAlto = false; });
};
`;
const rocha3d = fs.readFileSync(__dirname + '/escalada-rocha3d.js.txt', 'utf8');
s = s.slice(0, fim) + joystick + '\n' + rocha3d + '\n' + logica + '\n' + s.slice(fim);
fs.writeFileSync(__dirname + '/proto-escalada.html', s);
console.log('proto-escalada.html ok', s.length);

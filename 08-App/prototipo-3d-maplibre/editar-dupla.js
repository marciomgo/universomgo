// MISSÃO EM DUPLA (até 4): faz uma CÓPIA do protótipo (proto-dupla.html) com sala de espera, QR Code, contagem,
// regra de 50 m, voltar à sala, mundo compartilhado e ataques visíveis pros outros. Não mexe nas páginas prontas.
// Rodar: node editar-dupla.js && node gerar-dupla.js
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
const r = (a, b) => { if (!s.includes(a)) throw new Error('falta: ' + a.slice(0, 90)); s = s.replace(a, () => b); };

// ---------- 1. telas: menu, sala de espera, contagem ----------
r('<div id="inicio"><div class="cxIni2"><button id="bInicio">📍 Ativar GPS e bússola</button><button id="bOffline">⬇ Baixar o parque pra jogar sem internet</button><div id="msgOff"></div></div></div>',
  `<div id="inicio"><div class="cxIni">
  <button id="bEntrarQR" style="display:none">📍 Entrar na sala <span id="codQR"></span></button>
  <button id="bCriar">📍 Criar sala</button>
  <button id="bVoltar" style="display:none">↩ Voltar à sala <span id="codVolta"></span></button>
  <div class="ou" id="ouEntrar">ou entre na sala de um amigo</div>
  <input id="codSala" inputmode="numeric" maxlength="4" placeholder="Código de 4 números" autocomplete="off">
  <button id="bEntrar">Entrar na sala</button>
  <div id="msgIni"></div></div></div>
<div id="lobby" style="display:none"><div class="cxLob">
  <div class="lobTit">Sala <b id="lobCod">0000</b></div>
  <img id="qrImg" alt="QR Code da sala" style="display:none">
  <div id="lobDica" class="lobDica"></div>
  <div id="lobStatus" class="lobDica" style="font-weight:bold"></div>
  <div id="lobLista"></div>
  <button id="bComecar" style="display:none">Começar</button>
  <div id="lobEspera" class="lobDica" style="display:none">Aguardando o criador começar...</div>
</div></div>
<div id="contagem" style="display:none"><div id="contNum">3</div></div>
<div id="chipSala" style="display:none"></div>
<div id="chipRede" style="display:none"></div>`);
r('<script src="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.1/maplibre-gl.js"></script>',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.1/maplibre-gl.js"></script>\n<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>');
r('</style>', `  .cxIni{display:flex;flex-direction:column;align-items:center;gap:12px;width:82%;max-width:320px}
  .cxIni button,.cxLob button{width:100%;font-size:19px;font-weight:bold;padding:18px 20px;border:0;border-radius:999px;background:#ffd54f;color:#2b2110;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer;touch-action:manipulation}
  .cxIni .ou{color:#fff;font-size:14px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  .cxIni input{width:100%;box-sizing:border-box;font-size:22px;text-align:center;letter-spacing:6px;padding:14px;border:3px solid #ffd54f;border-radius:999px;background:#fff8e1;color:#2b2110}
  #msgIni{color:#fff;font-size:14px;min-height:18px;text-shadow:0 1px 3px rgba(0,0,0,.7);text-align:center}
  #chipSala{position:absolute;left:10px;top:10px;z-index:6;background:rgba(40,30,20,.75);color:#ffd54f;border-radius:12px;padding:6px 12px;font-size:13px;font-weight:bold}
  #chipRede{position:absolute;left:10px;top:44px;z-index:6;background:rgba(40,30,20,.7);color:#fff;border-radius:10px;padding:3px 10px;font-size:11px}
  #lobby{position:absolute;inset:0;z-index:31;display:none;align-items:center;justify-content:center;background:rgba(25,35,18,.72);overflow:auto}
  .cxLob{background:#fff8e1;border:4px solid #ffd54f;border-radius:24px;padding:16px 18px;width:88%;max-width:340px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.5);margin:10px 0}
  .lobTit{font-size:20px;color:#2b2110}.lobTit b{font-size:34px;letter-spacing:6px}
  #qrImg{width:180px;height:180px;margin:8px auto;display:block;border-radius:10px;background:#fff}
  .lobDica{font-size:13px;color:#5a4a2a;margin:6px 0 10px}
  .lobLin{display:flex;align-items:center;gap:8px;text-align:left;padding:7px 8px;border-radius:12px;background:#fff;margin-bottom:6px;font-size:14px;color:#2b2110;border:2px solid #ffe082}
  .lobLin i{width:14px;height:14px;border-radius:50%;flex:none}
  .lobLin span{font-size:12px;color:#7a6a45;margin-left:auto;text-align:right}
  .lobLin span.ok{color:#2e7d32;font-weight:bold}.lobLin span.ruim{color:#c62828;font-weight:bold}
  #bComecar:disabled{opacity:.45;box-shadow:none}
  #contagem{position:absolute;inset:0;z-index:50;display:none;align-items:center;justify-content:center;background:rgba(20,32,14,.55)}
  #contNum{font-size:150px;font-weight:bold;color:#ffd54f;text-shadow:0 6px 0 #b57f00,0 10px 24px rgba(0,0,0,.5);animation:popC .5s ease-out}
  @keyframes popC{0%{transform:scale(2.2);opacity:0}100%{transform:scale(1);opacity:1}}
  .amigo{width:35px;height:100px;pointer-events:none}
  .amigo img{position:absolute;left:0;bottom:0;width:35px;height:95px;filter:drop-shadow(0 3px 2px rgba(0,0,0,.4))}
  .amigo .anelA{position:absolute;left:50%;bottom:-6px;width:56px;height:20px;margin-left:-28px;border-radius:50%;border:3px solid #29b6f6}
  .amigo .nomeA{position:absolute;left:50%;top:-24px;transform:translateX(-50%);font-size:11px;font-weight:bold;color:#fff;background:#0288d1;border-radius:8px;padding:1px 6px;white-space:nowrap}
  .amigo .vida{top:-9px}
</style>`);
// o botão único e o "jogar de novo" antigos saem; o fluxo novo mora no bloco de rede
r(`document.getElementById('bInicio').onclick = function () {
  jogoIniciado = true;
  document.getElementById('inicio').style.display = 'none';
  document.getElementById('bGps').click(); // liga GPS e bússola (precisa ser dentro do toque)
};`, '');
r("document.getElementById('bDeNovo').onclick = function () { // nova rodada em volta de onde você está\n  document.getElementById('parabens').style.display = 'none'; reiniciarEstoques(); spawnAoRedor(POS.lat, POS.lng);\n};", '');

// ---------- 2. GPS: guarda a precisão e o estado; a missão só nasce quando a partida começa ----------
r(`      ALVO.lat = p.coords.latitude; ALVO.lng = p.coords.longitude; aviso('');
      if (!ALVO.visto) { ALVO.visto = true; POS.lat = ALVO.lat; POS.lng = ALVO.lng; if (DADOS.livre) spawnAoRedor(POS.lat, POS.lng); }
    }, function () { aviso('Sem GPS. Verifique se a localização está ligada e permitida.'); modoReal = false; }, { enableHighAccuracy: true });`,
`      ALVO.lat = p.coords.latitude; ALVO.lng = p.coords.longitude; ALVO.acc = p.coords.accuracy || 0; aviso(''); gpsStatus = 'ok';
      if (!ALVO.visto) { ALVO.visto = true; POS.lat = ALVO.lat; POS.lng = ALVO.lng; }
    }, function () { aviso('Sem GPS. Verifique se a localização está ligada e permitida.'); modoReal = false; gpsStatus = 'sem'; }, { enableHighAccuracy: true });`);

// ---------- 3. fogo: o voo é visual (aparece em todos); o dano é decidido só por quem roda o jogo ----------
const f0 = s.indexOf('// bola de fogo do chefão:'), f1 = s.indexOf('// contorna construções e água');
if (f0 < 0 || f1 < 0) throw new Error('fogo');
s = s.slice(0, f0) + `// bola de fogo: o voo é visual (aparece em todos os celulares); o dano é decidido só pelo anfitrião
function voarFogo(de, alvo, final, dur, aoChegar, aoMover) { /* aoMover(pos) devolve true se o fogo acertou alguém (some na hora) */
  var fora = document.createElement('div'); fora.style.zIndex = 99990;
  var el = document.createElement('div'); el.className = 'fogo' + (final ? ' roxo' : ''); el.textContent = '🔥'; fora.appendChild(el);
  var mk = new maplibregl.Marker({ element: fora, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([de.lng, de.lat]).addTo(mapa);
  var t0 = performance.now(), ultRastro = 0;
  (function voo(agora) {
    var t = Math.min(1, (agora - t0) / dur);
    mk.setLngLat([de.lng + (alvo.lng - de.lng) * t, de.lat + (alvo.lat - de.lat) * t]);
    el.style.transform = 'translateY(' + (-(34 - 22 * t)) + 'px)';
    if (agora - ultRastro > 90) { ultRastro = agora; rastro(el, false, final ? 'roxo' : 'fogo'); }
    if (aoMover && aoMover({ lat: de.lat + (alvo.lat - de.lat) * t, lng: de.lng + (alvo.lng - de.lng) * t })) { mk.remove(); if (aoChegar) aoChegar(); return; }
    if (t < 1) { requestAnimationFrame(voo); return; }
    mk.remove(); if (aoChegar) aoChegar();
  })(t0);
}
function dispararFogo(i, tp, alvoJ) { /* o fogo segue reto na direção de quem foi mirado até o limite do alcance (35 m); acerta qualquer jogador visível a menos de 3 m do caminho */
  i.balaEmVoo = true;
  tocarSomTiroChefao(i.final);
  var cl = Math.cos(i.lat * rad), dl = (tp.lat - i.lat) * 111320, dn = (tp.lng - i.lng) * 111320 * cl, dd = Math.hypot(dl, dn) || 1;
  var de = { lat: i.lat, lng: i.lng }, fim = { lat: i.lat + (dl / dd * FOGO_ALCANCE_M) / 111320, lng: i.lng + (dn / dd * FOGO_ALCANCE_M) / (111320 * cl) };
  var durF = (FOGO_ALCANCE_M / FOGO_VEL_MS) * 1000;
  net.enviar({ t: 'fogo', de: [de.lat, de.lng], para: [fim.lat, fim.lng], f: i.final ? 1 : 0, dur: durF });
  voarFogo(de, fim, i.final, durF, function () { i.balaEmVoo = false; }, function (pos) {
    var alvos = [{ ref: POS, pid: null, sat: satelite }];
    for (var kj in outros) { var oj = outros[kj]; if (oj.visto) alvos.push({ ref: oj, pid: oj.pid, sat: oj.sat }); }
    for (var q = 0; q < alvos.length; q++) {
      var a = alvos[q]; if (a.sat) continue; /* quem está na vista de cima não é atingido */
      var ex = (pos.lat - a.ref.lat) * 111320, ey = (pos.lng - a.ref.lng) * 111320 * Math.cos(a.ref.lat * rad);
      if (Math.sqrt(ex * ex + ey * ey) <= RAIO_ACERTO_FOGO_M) {
        var v = i.final ? DANO_FOGO_FINAL : DANO_FOGO;
        if (a.pid) net.enviarPara(a.pid, { t: 'dano', v: v, k: 'f' }); else { tocarSomAtingido(); levarDano(v); }
        return true;
      }
    }
    return false;
  });
}
` + s.slice(f1);

// ---------- 4. IA do anfitrião: cada monstro persegue o jogador MAIS PERTO (eu ou qualquer um dos outros) ----------
r(`  if (!jogoIniciado) return; // parado até tocar no botão de ativar o GPS
  quadroMov++;
  inimigos.forEach(function (i) {
    if (!i.vivo) return;
    var m = metrosAte(i.lat, i.lng), anda = false;
    var naArea = m.d <= GALHO_ALCANCE_M && Math.abs(difAng(heading, m.ang)) <= GALHO_CONE;`,
`  if (!jogoIniciado) return; // parado até a partida começar
  if (net.papel === 'convidado') { atualizarComoConvidado(dt, agora); return; } // o convidado só mostra; quem roda o jogo é o anfitrião
  quadroMov++;
  inimigos.forEach(function (i) {
    if (!i.vivo) return;
    var eu = metrosAte(i.lat, i.lng), m = satelite ? { d: 1e9, ang: 0 } : eu, anda = false, alvoJ = null, tp = POS; /* quem está na vista de satélite fica invisível: ninguém o persegue */
    for (var pidJ in outros) { var oj = outros[pidJ]; if (!oj.visto || oj.sat) continue; var da = metrosDe(oj, i.lat, i.lng); if (da.d < m.d) { m = da; alvoJ = oj; tp = oj; } }
    var naArea = eu.d <= GALHO_ALCANCE_M && Math.abs(difAng(heading, eu.ang)) <= GALHO_CONE;`);
r('var mira = m.d > 7 ? deslocar(POS.lat, POS.lng, 2.5, i.ang0) : POS;', 'var mira = m.d > 7 ? deslocar(tp.lat, tp.lng, 2.5, i.ang0) : tp;');
r('      if (m.d <= CONTATO_M && agora - ultimaMordida > INTERVALO_MORDIDA) mordida(agora);',
  "      if (alvoJ) { if (m.d <= CONTATO_M && agora - (i._mordAmigo || 0) > INTERVALO_MORDIDA) { i._mordAmigo = agora; net.enviarPara(alvoJ.pid, { t: 'dano', v: DANO_MORDIDA, k: 'm' }); } }\n      else if (m.d <= CONTATO_M && agora - ultimaMordida > INTERVALO_MORDIDA) mordida(agora);");
r('i.proximoFogo = agora + RECARGA_FOGO_MS; dispararFogo(i); }', 'i.proximoFogo = agora + RECARGA_FOGO_MS; dispararFogo(i, tp, alvoJ); }');
r('function metrosAte(lat, lng) {', `function metrosDe(p, lat, lng) { // distância e direção de um jogador (p) até um ponto
  var dl = (lat - p.lat) * 111320, dn = (lng - p.lng) * 111320 * Math.cos(p.lat * rad);
  return { d: Math.sqrt(dl * dl + dn * dn), ang: (Math.atan2(dn, dl) / rad + 360) % 360 };
}
function metrosAte(lat, lng) {`);

// ---------- 5. campo de caminho: parte de todos os jogadores ----------
const c0 = s.indexOf('function atualizarCampo() {'), c1 = s.indexOf('function passoDoCampo(i) {');
if (c0 < 0 || c1 < 0) throw new Error('campo');
s = s.slice(0, c0) + `function atualizarCampo() {
  var g = GRADE; if (!g) return;
  var n = g.n, fontes = satelite ? [] : [POS]; for (var pidC in outros) { if (outros[pidC].visto && !outros[pidC].sat) fontes.push(outros[pidC]); }
  g.dist.fill(-1); g.ok = false;
  var fila = new Int32Array(n * n), ini = 0, fim = 0;
  fontes.forEach(function (p) {
    var c = celulaDe(g, p.lat, p.lng);
    if (c[0] < 1 || c[1] < 1 || c[0] >= n - 1 || c[1] >= n - 1) return;
    var o = c[1] * n + c[0]; if (g.dist[o] === 0) return; g.dist[o] = 0; fila[fim++] = o;
  });
  if (!fim) return;
  while (ini < fim) {
    var cur = fila[ini++], cx = cur % n, cy = (cur / n) | 0, d = g.dist[cur];
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      var id = ny * n + nx; if (g.dist[id] >= 0 || g.bloq[id]) continue;
      if (dx && dy && (g.bloq[cy * n + nx] || g.bloq[ny * n + cx])) continue;
      g.dist[id] = d + 1; fila[fim++] = id;
    }
  }
  g.ok = true;
}
` + s.slice(c1);

// ---------- 6. ataques: quem ataca avisa os outros; acerto passa pelo anfitrião ----------
r('function acertou(i, dano) {', 'function acertouLocal(i, dano) {');
r("  var altIni = iniY, altFim = alvo ? (alvo.chefao ? 40 : 22) : 0, arco = 30 + dist;",
  "  var altIni = iniY, altFim = alvo ? (alvo.chefao ? 40 : 22) : 0, arco = 30 + dist;\n  net.enviar({ t: 'atq', p: net.pid, k: tipo, de: [de.lat, de.lng], para: alvo ? [alvo.lat, alvo.lng] : [reto.lat, reto.lng], dur: dur, alt: altFim });");
r("  if (!tocarFramesGolpe()) { elGalho.classList.remove('bate'); void elGalho.offsetWidth; elGalho.classList.add('bate'); }",
  "  if (!tocarFramesGolpe()) { elGalho.classList.remove('bate'); void elGalho.offsetWidth; elGalho.classList.add('bate'); }\n  net.enviar({ t: 'atq', p: net.pid, k: 'pau' });");


// ---------- 7. o bloco de rede ----------
const fim = s.lastIndexOf('</script>');
s = s.slice(0, fim) + `
// =====================================================================
//  MISSÃO EM DUPLA (até 4): um mundo só, vários celulares (PeerJS: celular a celular, em estrela).
//  O criador é o anfitrião: roda monstros, fogo e dano e manda o estado a 4 vezes por segundo.
//  Os outros mostram o mundo e mandam posição, golpes e acertos. Se o anfitrião cair, o convidado de menor
//  número assume a mesma sala (mesmo código) e os outros reconectam. Quem cai volta com o mesmo código.
// =====================================================================
var COR_JOG = ['#29b6f6', '#ef5350', '#66bb6a', '#ffa726'], MAX_JOG = 4, DIST_MAX_M = 50, TETO_ZUMBIS = 30;
var gpsStatus = 'proc'; // 'proc' (procurando) | 'ok' | 'sem' (sem GPS: modo de teste no computador)
var net = { papel: null, peer: null, conn: null, pid: null, sala: null, fase: 'menu', timer: null, tPos: null, reconTent: 0, reconectando: false, ultimoJs: [] };
var eu = { slot: 0, nome: 'Jogador 1', cor: COR_JOG[0] };
var outros = {}, rodada = 0, rodadaVista = -1, porId = {};
try { net.pid = sessionStorage.getItem('mgo-pid'); } catch (e) {}
if (!net.pid) { net.pid = 'p' + Math.random().toString(36).slice(2, 8); try { sessionStorage.setItem('mgo-pid', net.pid); } catch (e) {} }
net.enviar = function (o) { // anfitrião: manda pra todos; convidado: manda pro anfitrião
  if (net.papel === 'anfitriao') { for (var k in outros) { var j = outros[k]; if (j.conectado && j.conn && j.conn.open) { try { j.conn.send(o); } catch (e) {} } } }
  else if (net.conn && net.conn.open) { try { net.conn.send(o); } catch (e) {} }
};
net.enviarPara = function (pid, o) { var j = outros[pid]; if (j && j.conectado && j.conn && j.conn.open) { try { j.conn.send(o); } catch (e) {} } };
function lembrarSala() { try { localStorage.setItem('mgo-ultima', JSON.stringify({ cod: net.sala, pid: net.pid, t: Date.now() })); } catch (e) {} }
function chip(t) { var c = document.getElementById('chipSala'); c.textContent = t; c.style.display = t ? 'block' : 'none'; }
function msgIni(t) { document.getElementById('msgIni').textContent = t; }
function nConectados() { var n = 0; for (var k in outros) { if (outros[k].conectado) n++; } return n; }

// ---- ajustes do jogo pra vários jogadores ----
function acertou(i, dano) {
  if (net.papel === 'convidado') { // o convidado só avisa; a vida de verdade vem do anfitrião
    net.enviar({ t: 'acerto', id: i.id, d: dano });
    var em = i.el.querySelector('.em'); em.classList.remove('golpe'); void em.offsetWidth; em.classList.add('golpe');
    i.vida = Math.max(0.01, i.vida - dano); i.el.querySelector('.vida i').style.width = Math.max(0, (i.vida / i.max) * 100) + '%';
    return;
  }
  acertouLocal(i, dano);
}
var celebrarOrig = celebrar;
celebrar = function () { celebrarOrig(); if (net.papel === 'anfitriao') net.enviar({ t: 'fim', z: estat.zumbis, mo: estat.monstros, s: Math.round((performance.now() - estat.t0) / 1000) }); };
var spawnAoRedorOrig = spawnAoRedor;
spawnAoRedor = function (lat, lng) { if (net.papel === 'convidado' || net.fase !== 'jogo') return; spawnAoRedorOrig(lat, lng); };
var spawnBaseOrig = spawnBase;
spawnBase = function (lat, lng) { // dificuldade: chefão com vida x número de jogadores; mais zumbis (até um teto, pra celular fraco aguentar)
  rodada++; spawnBaseOrig(lat, lng);
  var N = 1 + nConectados(); if (N < 2) return;
  inimigos.forEach(function (i) { if (i.chefao) { i.max *= N; i.vida = i.max; } });
  var nz = inimigos.filter(function (i) { return !i.chefao; }).length, extra = Math.min(TETO_ZUMBIS - nz, nz * (N - 1));
  for (var k = 0; k < extra; k++) { var z = pontoLivre(lat, lng, 14 + Math.random() * 16, Math.random() * 360); novoInimigo(z.lat, z.lng, 'p-zumbi', '🧟', 5); }
};
function reiniciarRodada() {
  document.getElementById('parabens').style.display = 'none'; reiniciarEstoques();
  if (net.papel === 'convidado') net.enviar({ t: 'denovo' }); else spawnAoRedor(POS.lat, POS.lng);
}
document.getElementById('bDeNovo').onclick = reiniciarRodada;

// ---- os outros jogadores no mapa ----
function criarAvatar(j) {
  if (j.el) return;
  var el = document.createElement('div'); el.className = 'amigo';
  el.innerHTML = '<span class="nomeA" style="background:' + j.cor + '">' + j.nome + '</span><div class="vida"><i></i></div><div class="anelA" style="border-color:' + j.cor + ';background:' + j.cor + '40"></div><img src="mineu-costas.png" alt="' + j.nome + '">';
  el._ll = [j.lng, j.lat]; marcadores.push(el);
  el._mk = new maplibregl.Marker({ element: el, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat(el._ll).addTo(mapa);
  j.el = el; j.visto = false; j.timers = [];
}
function removerAvatar(j) {
  if (!j.el) return;
  j.el._mk.remove(); var k = marcadores.indexOf(j.el); if (k >= 0) marcadores.splice(k, 1); j.el = null; j.visto = false;
}
function novoOutro(pid, slot, nome, cor) { var j = outros[pid]; if (!j) { j = outros[pid] = { pid: pid, slot: slot, nome: nome, cor: cor, lat: POS.lat, lng: POS.lng, alvoLat: POS.lat, alvoLng: POS.lng, vida: 100, conectado: true }; } return j; }
function posDoOutro(j, x, y, v, a) {
  j.alvoLat = x; j.alvoLng = y; j.vida = v; j.arma = a;
  if (!j.el) criarAvatar(j);
  if (!j.visto) { j.lat = x; j.lng = y; j.visto = true; }
}
function pintarAvatar(j, conj, idx) { // conj: 'p' = pau, 'e' = estilingue
  if (!j.el) return;
  var F = conj === 'p' ? FRAME_GOLPE : (conj === 'a' ? FRAME_ANDAR : FRAME_EST), img = j.el.querySelector('img'), cg = 0.3631, e = 0.5;
  if (F.prontos < F.src.length) return;
  img.src = F.src[idx]; img.style.width = (F.w * cg * e) + 'px'; img.style.height = (F.h * cg * e) + 'px';
  img.style.left = (17.5 - F.ax * cg * e) + 'px'; img.style.top = ((100 - 0.65) - F.ay * cg * e) + 'px'; img.style.bottom = 'auto';
}
function poseDoOutro(j) { // pose parada conforme a arma na mão
  if (!j.el || j.anim || j.andando) return;
  var conj = j.arma === 'galho' ? 'p' : (j.arma ? 'e' : null);
  if (j.conjVisto === conj) return;
  j.conjVisto = conj; if (conj) pintarAvatar(j, conj, 0);
}
function animarAvatar(j, seq) { // seq: [[ms, conj, quadro], ...]; no fim volta à pose parada
  if (!j.el) return;
  (j.timers || []).forEach(clearTimeout); j.timers = []; j.anim = true;
  seq.forEach(function (q) { j.timers.push(setTimeout(function () { pintarAvatar(j, q[1], q[2]); }, q[0])); });
  j.timers.push(setTimeout(function () { j.anim = false; j.conjVisto = null; }, seq[seq.length - 1][0] + 40));
}
function atqDeOutro(m) { // o que o outro jogador está fazendo: pedra normal, pedra amarela ou paulada
  var j = outros[m.p]; if (!j || !j.el) return;
  if (m.k === 'pau') { animarAvatar(j, [[0, 'p', 1], [130, 'p', 2], [330, 'p', 0]]); tocarTom(700, 180, 110, 'sawtooth', 0.04); return; }
  animarAvatar(j, [[0, 'e', 1], [280, 'e', 0]]); tocarTom(880, 220, 110, 'square', 0.05);
  var de = { lat: m.de[0], lng: m.de[1] }, para = { lat: m.para[0], lng: m.para[1] }, tipo = m.k;
  var fora = document.createElement('div'); fora.style.zIndex = 100001;
  var el = document.createElement('div'); el.className = 'pedrada' + (tipo === 'esp' ? ' esp' : ''); el.innerHTML = tipo === 'esp' ? '<span class="pe-amarela">🪨</span>' : '🪨'; fora.appendChild(el);
  var mk = new maplibregl.Marker({ element: fora, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([de.lng, de.lat]).addTo(mapa);
  var dl = (para.lat - de.lat) * 111320, dn = (para.lng - de.lng) * 111320 * Math.cos(de.lat * rad), dist = Math.sqrt(dl * dl + dn * dn);
  var t0 = performance.now(), dur = m.dur || 700, altIni = 36, altFim = m.alt || 0, arco = 30 + dist;
  (function voo(agora) {
    var t = Math.min(1, (agora - t0) / dur);
    mk.setLngLat([de.lng + (para.lng - de.lng) * t, de.lat + (para.lat - de.lat) * t]);
    var h = altIni + (altFim - altIni) * t + Math.sin(Math.PI * t) * arco;
    el.style.transform = 'translateY(' + (-h) + 'px) rotate(' + (t * 1100) + 'deg)';
    if (t < 1) { requestAnimationFrame(voo); return; }
    mk.remove();
  })(t0);
}
function atualizarOutros(dt) {
  var k = 1 - Math.exp(-6 * dt);
  for (var pid in outros) {
    var j = outros[pid]; if (!j.el || !j.visto) continue;
    j.el.style.display = j.sat ? 'none' : '';
    j.lat += (j.alvoLat - j.lat) * k; j.lng += (j.alvoLng - j.lng) * k;
    j.el._mk.setLngLat([j.lng, j.lat]); j.el._ll = [j.lng, j.lat];
    j.el.querySelector('.vida i').style.width = Math.max(0, j.vida) + '%';
    var agoraMs = performance.now(), vj = velRastro(j.rastro || (j.rastro = { p: [] }), j.lat, j.lng, agoraMs);
    if (j.rastro.mov && !j.anim && FRAME_ANDAR.prontos >= 3) { // o amigo está andando: passada
      j.andando = true; var ix = idxPassada(j.rastro, agoraMs, vj);
      if (ix !== j.idxA) { j.idxA = ix; pintarAvatar(j, 'a', ix); }
    } else if (j.andando) { j.andando = false; j.conjVisto = null; j.idxA = -1; }
    poseDoOutro(j);
  }
}
mapa.on('load', function () { var u = performance.now(); (function loopOutros(a) { var dt = Math.min(0.05, (a - u) / 1000); u = a; atualizarOutros(dt); requestAnimationFrame(loopOutros); })(u); });

// ---- estado do jogo: anfitrião -> convidados ----
function aplicarEstado(m) {
  if (m.r !== rodadaVista) { // rodada nova: reconstrói os monstros
    limparInimigos(); porId = {}; rodadaVista = m.r; estat = { zumbis: 0, monstros: 0, t0: performance.now() }; celebrou = false;
    document.getElementById('parabens').style.display = 'none';
  }
  m.m.forEach(function (e) {
    var i = porId[e[0]];
    if (!i) {
      novoInimigo(e[1], e[2], e[5] ? 'p-chefao' : 'p-zumbi', e[6] ? '👿' : (e[5] ? '👹' : '🧟'), e[7]);
      i = inimigos[inimigos.length - 1]; i.id = e[0]; porId[e[0]] = i;
    }
    i.alvoLat = e[1]; i.alvoLng = e[2];
    if (i.vivo) {
      if (e[3] < i.vida - 0.05) { var emF = i.el.querySelector('.em'); emF.classList.remove('golpe'); void emF.offsetWidth; emF.classList.add('golpe'); estouro(i.el); } // levou golpe de outro jogador
      i.vida = e[3]; i.el.querySelector('.vida i').style.width = Math.max(0, (i.vida / i.max) * 100) + '%';
    }
    if (i.vivo && !e[4]) { // morreu no anfitrião
      i.vivo = false; var em = i.el.querySelector('.em'); i.el.querySelector('.vida').style.display = 'none'; em.textContent = '💥';
      setTimeout(function () { i.el._mk.remove(); }, 500);
      if (i.chefao) estat.monstros++; else estat.zumbis++;
    }
  });
  if (m.ar) definirAreaLivre(m.ar[0], m.ar[1]);
  if (m.nv) { NIVEL = m.nv; pintaNivel(); }
  net.ultimoJs = m.js || [];
  (m.js || []).forEach(function (e) { // [pid, lat, lng, vida, arma, slot, nome, cor]
    if (e[0] === net.pid) return;
    var j = novoOutro(e[0], e[5], e[6], e[7]); j.conectado = true; posDoOutro(j, e[1], e[2], e[3], e[4]); j.sat = !!e[8];
  });
  var presentes = {}; (m.js || []).forEach(function (e) { presentes[e[0]] = 1; });
  for (var kk in outros) { if (!presentes[kk]) { removerAvatar(outros[kk]); delete outros[kk]; } } // quem saiu some do mapa
  if (net.fase === 'jogo') chip('Sala ' + net.sala + ' · ' + (m.js || []).length + ' jogadores');
}
function atualizarComoConvidado(dt, agora) {
  var k = 1 - Math.exp(-8 * dt);
  inimigos.forEach(function (i) {
    if (!i.vivo) return;
    if (i.alvoLat !== undefined) {
      var antes = i.lat + i.lng; i.lat += (i.alvoLat - i.lat) * k; i.lng += (i.alvoLng - i.lng) * k;
      i.el._mk.setLngLat([i.lng, i.lat]); i.el._ll = [i.lng, i.lat];
      i.el.firstChild.classList.toggle('anda-z', Math.abs(i.lat + i.lng - antes) > 4e-8);
    }
    var e2 = metrosAte(i.lat, i.lng), naArea = e2.d <= GALHO_ALCANCE_M && Math.abs(difAng(heading, e2.ang)) <= GALHO_CONE;
    if (naArea && !i.naArea) i.tEntrada = agora;
    i.naArea = naArea;
  });
}
function estadoParaConvidados() {
  var js = [[net.pid, POS.lat, POS.lng, vidaMineu, ativa, eu.slot, eu.nome, eu.cor, satelite ? 1 : 0]];
  for (var k in outros) { var j = outros[k]; if (j.conectado && j.visto) js.push([j.pid, j.alvoLat, j.alvoLng, j.vida, j.arma, j.slot, j.nome, j.cor, j.sat ? 1 : 0]); }
  return { t: 'estado', r: rodada, nv: NIVEL, ar: (AREA && AREA.raio) ? [AREA.lat, AREA.lng] : null, js: js, m: inimigos.map(function (i) { return [i.id, i.lat, i.lng, Math.round(i.vida * 10) / 10, i.vivo ? 1 : 0, i.chefao ? 1 : 0, i.final ? 1 : 0, i.max]; }) };
}

// ---- sala de espera ----
function calcRoster() { // anfitrião: quem está na sala e se está pronto (GPS firme e a até 50 m do criador)
  var lista = [{ pid: net.pid, nome: eu.nome, cor: eu.cor, st: gpsStatus === 'proc' ? 'proc' : 'ok', dist: 0 }];
  for (var k in outros) {
    var j = outros[k]; if (!j.conectado) continue;
    var st = 'proc', d = 0;
    if (j.g === 'sem' || gpsStatus === 'sem') st = (!j.g || j.g === 'proc') ? 'proc' : 'ok';
    else if (j.g === 'ok') { var m = metrosDe(POS, j.alvoLat !== undefined ? j.alvoLat : j.lat, j.alvoLng !== undefined ? j.alvoLng : j.lng); d = Math.round(m.d); st = m.d <= DIST_MAX_M + (j.acc || 0) ? 'ok' : 'longe'; }
    lista.push({ pid: j.pid, nome: j.nome, cor: j.cor, st: st, dist: d });
  }
  return lista;
}
function renderLobby(lista) {
  var h = '';
  lista.forEach(function (p) {
    var t = p.st === 'ok' ? '<span class="ok">pronto ✓</span>' : (p.st === 'longe' ? '<span class="ruim">longe: ' + p.dist + ' m (chegue a ' + DIST_MAX_M + ' m)</span>' : '<span>procurando o GPS…</span>');
    h += '<div class="lobLin"><i style="background:' + p.cor + '"></i>' + p.nome + (p.pid === net.pid ? ' (você)' : '') + t + '</div>';
  });
  document.getElementById('lobLista').innerHTML = h;
  if (net.papel === 'anfitriao') {
    var pronto = lista.every(function (p) { return p.st === 'ok'; }), b = document.getElementById('bComecar');
    b.disabled = !pronto; b.textContent = lista.length < 2 ? 'Começar sozinho' : 'Começar (' + lista.length + ' jogadores)';
  }
  chip('Sala ' + net.sala + ' · ' + lista.length + ' na sala');
}
function mostrarLobby() {
  document.getElementById('inicio').style.display = 'none'; document.getElementById('lobby').style.display = 'flex';
  document.getElementById('lobCod').textContent = net.sala;
  var host = net.papel === 'anfitriao';
  document.getElementById('bComecar').style.display = host ? 'block' : 'none';
  document.getElementById('lobEspera').style.display = host ? 'none' : 'block';
  var qr = document.getElementById('qrImg');
  if (host && typeof qrcode !== 'undefined') {
    var q = qrcode(0, 'M'); q.addData(location.href.split('?')[0].split('#')[0] + '?sala=' + net.sala); q.make();
    qr.src = q.createDataURL(6, 2); qr.style.display = 'block';
  } else qr.style.display = 'none';
  document.getElementById('lobDica').textContent = host ? 'Peça pros amigos apontarem a câmera pro QR Code. Todos precisam estar a até ' + DIST_MAX_M + ' m de você, com o GPS ligado.' : 'Fique a até ' + DIST_MAX_M + ' m do criador, com o GPS ligado.';
}
function rodarContagem() {
  net.fase = 'contagem'; document.getElementById('lobby').style.display = 'none';
  var box = document.getElementById('contagem'), num = document.getElementById('contNum'); box.style.display = 'flex';
  var n = 3;
  (function tick() {
    num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
    if (n > 0) { num.textContent = n; tocarTom(660, 660, 160, 'square', 0.1); n--; setTimeout(tick, 1000); }
    else { num.textContent = 'Valendo!'; num.style.fontSize = '64px'; tocarTom(1047, 1047, 420, 'square', 0.12); setTimeout(function () { box.style.display = 'none'; num.style.fontSize = ''; iniciarPartida(); }, 800); }
  })();
}
function iniciarPartida() {
  net.fase = 'jogo'; jogoIniciado = true; document.getElementById('lobby').style.display = 'none'; document.getElementById('inicio').style.display = 'none';
  clearInterval(net.timer);
  if (net.papel === 'anfitriao') { net.timer = setInterval(function () { net.enviar(estadoParaConvidados()); }, 250); spawnAoRedor(POS.lat, POS.lng); }
  chip('Sala ' + net.sala + ' · ' + (1 + nConectados()) + ' jogadores');
}
document.getElementById('bComecar').onclick = function () {
  if (net.papel !== 'anfitriao' || net.fase !== 'sala') return;
  if (!calcRoster().every(function (p) { return p.st === 'ok'; })) return;
  net.enviar({ t: 'contagem' }); rodarContagem();
};

// ---- anfitrião ----
function ativarGps() { if (!modoReal) document.getElementById('bGps').click(); } // precisa rodar dentro do toque (GPS e bússola)
function statusSala(ok) { var e = document.getElementById('lobStatus'); if (!e) return; e.textContent = ok ? 'Sala no ar ✓ — mantenha esta página aberta e à frente' : 'Sala fora do ar — reconectando…'; e.style.color = ok ? '#2e7d32' : '#c62828'; }
function manterAcordado() { // evita a tela apagar e o navegador "dormir" a página (aí a sala some do servidor)
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(function () {}); } catch (e) {}
  try { if (navigator.locks && !net.lockPego) { net.lockPego = true; navigator.locks.request('mgo-dupla', function () { return new Promise(function () {}); }); } } catch (e) {}
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible') return;
  manterAcordado(); if (net.peer && net.peer.disconnected && !net.peer.destroyed) { try { net.peer.reconnect(); } catch (e) {} }
});
function recriarSala() { // a conexão com o servidor foi encerrada de vez: abre de novo com o MESMO código
  var np = new Peer('mgo-dupla-' + net.sala); net.peer = np;
  np.on('open', function () { ouvirConexoes(); statusSala(true); });
  np.on('disconnected', function () { statusSala(false); try { np.reconnect(); } catch (e) {} });
  np.on('error', function () {}); // se o código ainda estiver preso no servidor, o vigia tenta de novo
}
function manterSalaViva() { // a sala some do servidor se a aba dorme ou a rede pisca: confere a cada 4 s e reconecta sozinho
  clearInterval(net.vigia);
  net.vigia = setInterval(function () {
    var p = net.peer; if (!p || net.papel !== 'anfitriao') return;
    if (p.destroyed) { statusSala(false); recriarSala(); return; }
    if (p.disconnected) { statusSala(false); try { p.reconnect(); } catch (e) {} } else statusSala(true);
  }, 4000);
}
function criarSala(tent) {
  if (typeof Peer === 'undefined') { msgIni('Sem conexão pra criar a sala. Verifique a internet.'); return; }
  var cod = ('000' + Math.floor(Math.random() * 10000)).slice(-4);
  var p = new Peer('mgo-dupla-' + cod); net.peer = p;
  p.on('open', function () {
    if (net.papel === 'anfitriao') { statusSala(true); return; } // reabriu depois de reconectar
    net.papel = 'anfitriao'; net.sala = cod; net.fase = 'sala'; eu = { slot: 0, nome: 'Jogador 1', cor: COR_JOG[0] }; lembrarSala();
    mostrarLobby(); ouvirConexoes(); statusSala(true); manterSalaViva(); manterAcordado();
    net.timer = setInterval(function () { var l = calcRoster(); renderLobby(l); net.enviar({ t: 'sala', l: l }); }, 500);
  });
  p.on('disconnected', function () { if (net.papel === 'anfitriao') { statusSala(false); try { p.reconnect(); } catch (e) {} } });
  p.on('error', function (e) { if (e.type === 'unavailable-id' && (tent || 0) < 5) { criarSala((tent || 0) + 1); return; } if (net.papel !== 'anfitriao') msgIni('Não consegui criar a sala. Verifique a internet e tente de novo.'); });
}
function ouvirConexoes() {
  net.peer.on('connection', function (conn) {
    var pidC = null;
    conn.on('data', function (m) { if (m.t === 'oi') { pidC = m.pid; aceitarJogador(conn, m); } else if (pidC) aoReceberDoJogador(pidC, m); });
    conn.on('close', function () { if (pidC) jogadorCaiu(pidC, conn); });
    conn.on('error', function () { if (pidC) jogadorCaiu(pidC, conn); });
  });
}
function aceitarJogador(conn, m) {
  var pid = m.pid, j = outros[pid];
  if (j) { // quem já estava na sala voltando (caiu a internet, recarregou a página)
    if (j.conn && j.conn !== conn) { try { j.conn.close(); } catch (e) {} }
    j.conn = conn; j.conectado = true; j.visto = false;
  } else {
    if (net.fase !== 'sala') { try { conn.send({ t: 'recusa', m: 'A missão já começou.' }); } catch (e) {} setTimeout(function () { conn.close(); }, 400); return; }
    if (1 + nConectados() >= MAX_JOG) { try { conn.send({ t: 'recusa', m: 'A sala está cheia (máximo ' + MAX_JOG + ').' }); } catch (e) {} setTimeout(function () { conn.close(); }, 400); return; }
    var usados = { 0: 1 }; for (var k in outros) usados[outros[k].slot] = 1;
    var slot = 1; while (usados[slot]) slot++;
    j = novoOutro(pid, slot, 'Jogador ' + (slot + 1), COR_JOG[slot]); j.conn = conn;
  }
  try { conn.send({ t: 'bemvindo', slot: j.slot, nome: j.nome, cor: j.cor, fase: net.fase, sala: net.sala }); } catch (e) {}
  if (net.fase === 'jogo') { aviso(j.nome + ' voltou!'); setTimeout(function () { aviso(''); }, 2500); }
}
function aoReceberDoJogador(pid, m) {
  var j = outros[pid]; if (!j) return;
  if (m.t === 'pos') { j.sat = !!m.s; j.g = m.g; j.acc = m.acc; j.rtt = m.rd; j.via = m.rv; posDoOutro(j, m.x, m.y, m.v, m.a); redeDoAnfitriao(); }
  else if (m.t === 'ping') net.enviarPara(pid, { t: 'pong', c: m.c });
  else if (m.t === 'acerto') { var i = inimigos.filter(function (x) { return x.id === m.id; })[0]; if (i && i.vivo) { tocarSomImpacto(); estouro(i.el); acertouLocal(i, m.d); } }
  else if (m.t === 'atq') { m.p = pid; atqDeOutro(m); for (var k in outros) { if (k !== pid) net.enviarPara(k, m); } }
  else if (m.t === 'denovo') { document.getElementById('parabens').style.display = 'none'; reiniciarEstoques(); net.enviar({ t: 'denovo' }); spawnAoRedor(POS.lat, POS.lng); }
}
function jogadorCaiu(pid, conn) {
  var j = outros[pid]; if (!j || j.conn !== conn) return; // já voltou por outra conexão
  j.conectado = false; removerAvatar(j);
  if (net.fase === 'sala' || net.fase === 'contagem') delete outros[pid]; // na sala de espera, quem sai libera a vaga
  aviso(j.nome + ' saiu.'); setTimeout(function () { aviso(''); }, 2500);
}

// ---- convidado ----
function entrarSala(cod, tent) {
  tent = tent || 1; var MAX = 4;
  if (typeof Peer === 'undefined') { msgIni('Sem conexão pra entrar na sala. Verifique a internet.'); return; }
  msgIni('Conectando' + (tent > 1 ? ' (tentativa ' + tent + ' de ' + MAX + ')' : '') + '...');
  try { if (net.peer) net.peer.destroy(); } catch (e) {}
  var p = new Peer(); net.peer = p; var fechado = false, esperando = null;
  function falhar(motivo, podeTentar) {
    if (fechado) return; fechado = true; clearTimeout(esperando); try { p.destroy(); } catch (e) {}
    if (podeTentar && tent < MAX) { msgIni(motivo + ' Tentando de novo...'); setTimeout(function () { entrarSala(cod, tent + 1); }, 2500); } else msgIni(motivo);
  }
  esperando = setTimeout(function () { falhar('A conexão demorou demais.', true); }, 25000);
  p.on('open', function () {
    var conn = p.connect('mgo-dupla-' + cod, { reliable: true });
    try { conn.peerConnection.addEventListener('iceconnectionstatechange', function () { if (conn.peerConnection.iceConnectionState === 'failed') falhar('Achei a sala, mas a rede não deixou os aparelhos se conectarem. Tente os dois no mesmo Wi-Fi.', false); }); } catch (e) {}
    conn.on('open', function () {
      if (fechado) return; fechado = true; clearTimeout(esperando);
      net.sala = cod; net.papel = 'convidado'; ligarComoConvidado(conn); manterAcordado();
      try { conn.send({ t: 'oi', pid: net.pid }); } catch (e) {}
    });
  });
  p.on('error', function (e) {
    if (net.reconectando) return; // as tentativas de reconexão cuidam disso
    if (e.type === 'peer-unavailable') falhar('A sala ' + cod + ' não está no ar. Confira o código e peça pro criador deixar a página aberta e à frente.', true);
    else falhar('Falha na conexão (' + e.type + ').', true);
  });
}
function atualizarChipRede(ms, via, quem) {
  var c = document.getElementById('chipRede'); if (!c) return;
  if (ms == null && !via) { c.style.display = 'none'; return; }
  c.textContent = 'rede (' + quem + '): ' + (via === 'relay' ? 'via relay' : (via === 'direta' ? 'direta' : '…')) + (ms != null ? ' · ' + ms + ' ms' : '');
  c.style.display = 'block';
}
function redeDoAnfitriao() { // mostra o convidado com o pior atraso
  var pior = null; for (var k in outros) { var j = outros[k]; if (j.conectado && j.rtt != null && (!pior || j.rtt > pior.rtt)) pior = j; }
  if (pior) atualizarChipRede(pior.rtt, pior.via, pior.nome);
}
function descobrirVia(conn) { // o caminho escolhido: direto entre os aparelhos ou passando por um servidor de apoio (relay)
  try {
    conn.peerConnection.getStats().then(function (st) {
      var via = null;
      st.forEach(function (r) {
        if (r.type === 'candidate-pair' && (r.selected || (r.nominated && r.state === 'succeeded'))) {
          var l = st.get(r.localCandidateId), rm = st.get(r.remoteCandidateId);
          via = ((l && l.candidateType === 'relay') || (rm && rm.candidateType === 'relay')) ? 'relay' : 'direta';
        }
      });
      if (via) net.via = via;
    });
  } catch (e) {}
}
function ligarComoConvidado(conn) {
  net.conn = conn;
  conn.on('data', aoReceberDoAnfitriao);
  conn.on('close', perdeuAnfitriao);
  conn.on('error', perdeuAnfitriao);
  clearInterval(net.tPos);
  net.tPos = setInterval(function () { net.enviar({ t: 'pos', s: satelite ? 1 : 0, x: POS.lat, y: POS.lng, v: vidaMineu, a: ativa, g: gpsStatus, acc: ALVO.acc || 0, rd: net.rtt, rv: net.via }); }, 400);
  clearInterval(net.tPing); net.tPing = setInterval(function () { net.enviar({ t: 'ping', c: performance.now() }); descobrirVia(conn); }, 3000);
}
function aoReceberDoAnfitriao(m) {
  if (m.t === 'bemvindo') {
    eu = { slot: m.slot, nome: m.nome, cor: m.cor }; net.sala = m.sala || net.sala; net.reconectando = false; net.reconTent = 0; lembrarSala();
    if (m.fase === 'jogo') { net.fase = 'jogo'; jogoIniciado = true; document.getElementById('inicio').style.display = 'none'; document.getElementById('lobby').style.display = 'none'; chip('Sala ' + net.sala + ' · jogando'); }
    else if (net.fase !== 'contagem') { net.fase = 'sala'; mostrarLobby(); }
  }
  else if (m.t === 'recusa') { msgIni(m.m); try { net.conn.close(); } catch (e) {} net.conn = null; clearInterval(net.tPos); net.papel = null; }
  else if (m.t === 'sala') { if (net.fase === 'sala') renderLobby(m.l); }
  else if (m.t === 'contagem') rodarContagem();
  else if (m.t === 'pong') { net.rtt = Math.round(performance.now() - m.c); atualizarChipRede(net.rtt, net.via, 'Anfitrião'); }
  else if (m.t === 'estado') { aplicarEstado(m); if (net.fase === 'sala') { net.fase = 'jogo'; jogoIniciado = true; document.getElementById('lobby').style.display = 'none'; } }
  else if (m.t === 'dano') { if (satelite) return; levarDano(m.v); if (m.k === 'm') tocarSomMordida(); else tocarSomAtingido(); }
  else if (m.t === 'fogo') { tocarSomTiroChefao(!!m.f); voarFogo({ lat: m.de[0], lng: m.de[1] }, { lat: m.para[0], lng: m.para[1] }, !!m.f, m.dur, null); }
  else if (m.t === 'atq') atqDeOutro(m);
  else if (m.t === 'fim') { estat.zumbis = m.z; estat.monstros = m.mo; estat.t0 = performance.now() - m.s * 1000; celebrou = false; celebrarOrig(); celebrou = true; }
  else if (m.t === 'denovo') { document.getElementById('parabens').style.display = 'none'; reiniciarEstoques(); }
}
function souSucessor() { // o convidado de menor número assume se o criador sair
  var menor = 99; net.ultimoJs.forEach(function (e) { if (e[5] > 0 && e[5] < menor) menor = e[5]; });
  return eu.slot > 0 && eu.slot <= menor;
}
function perdeuAnfitriao() {
  if (net.papel !== 'convidado' || net.reconectando) return;
  net.reconectando = true; net.reconTent = 0; net.conn = null; clearInterval(net.tPos); chip('Reconectando...');
  tentarReconectar();
}
function tentarReconectar() {
  if (net.papel !== 'convidado' || !net.reconectando) return;
  net.reconTent++;
  if (net.reconTent > 5) { // o anfitrião não voltou
    if (souSucessor()) { assumirAnfitriao(); return; }
    if (net.reconTent > 28) { net.reconectando = false; chip('Sala ' + net.sala + ' · sem conexão'); aviso('Perdi a conexão com a sala. Recarregue a página e toque em "Voltar à sala".'); return; }
  }
  try { if (net.peer.disconnected) net.peer.reconnect(); } catch (e) {}
  var conn = net.peer.connect('mgo-dupla-' + net.sala, { reliable: true });
  var tm = setTimeout(function () { try { conn.close(); } catch (e) {} tentarReconectar(); }, 3500);
  conn.on('open', function () { clearTimeout(tm); net.reconectando = false; net.reconTent = 0; ligarComoConvidado(conn); try { conn.send({ t: 'oi', pid: net.pid }); } catch (e) {} aviso('Reconectado!'); setTimeout(function () { aviso(''); }, 2000); });
  net.peer.once('error', function () { clearTimeout(tm); setTimeout(tentarReconectar, 900); });
}
function assumirAnfitriao() { // o criador saiu: este celular assume a MESMA sala (mesmo código) do ponto onde o jogo parou
  net.reconectando = false; chip('Assumindo a sala...');
  var np = new Peer('mgo-dupla-' + net.sala);
  np.on('open', function () {
    net.peer = np; net.papel = 'anfitriao'; rodada = rodadaVista; net.fase = 'jogo';
    for (var k in outros) { removerAvatar(outros[k]); delete outros[k]; }
    net.ultimoJs.forEach(function (e) { if (e[0] !== net.pid) { var j = novoOutro(e[0], e[5], e[6], e[7]); j.conectado = false; } }); // eles voltam sozinhos
    ouvirConexoes(); clearInterval(net.timer); net.timer = setInterval(function () { net.enviar(estadoParaConvidados()); }, 250);
    if (carregarObstaculos(POS.lat, POS.lng)) construirGrade(POS.lat, POS.lng);
    aviso('O criador saiu. Você assumiu a sala.'); setTimeout(function () { aviso(''); }, 3500); chip('Sala ' + net.sala + ' · você é o anfitrião');
    setTimeout(verificarFim, 500);
  });
  np.on('error', function (e) { if (e.type === 'unavailable-id') { net.reconectando = true; net.reconTent = 0; tentarReconectar(); } }); // alguém já assumiu: reconecta nele
}

// ---- menu ----
(function menu() {
  var qs = (location.search.match(/[?&]sala=(\\d{4})/) || [])[1], ult = null;
  try { ult = JSON.parse(localStorage.getItem('mgo-ultima') || 'null'); } catch (e) {}
  if (qs) { document.getElementById('bEntrarQR').style.display = 'block'; document.getElementById('codQR').textContent = qs; document.getElementById('bCriar').style.display = 'none'; document.getElementById('ouEntrar').style.display = 'none'; document.getElementById('codSala').style.display = 'none'; document.getElementById('bEntrar').style.display = 'none'; }
  else if (ult && ult.cod && Date.now() - ult.t < 3 * 3600 * 1000) { /* o botão só aparece se a sala ainda estiver no ar */
    verificarSalaNoAr(ult.cod, function (viva) {
      if (viva === false) { try { localStorage.removeItem('mgo-ultima'); } catch (e) {} return; }
      document.getElementById('bVoltar').style.display = 'block'; document.getElementById('codVolta').textContent = ult.cod;
    });
  }
  function verificarSalaNoAr(cod, fim) { /* true = no ar, false = não existe mais, null = não deu pra saber (sem internet / demorou) */
    var feito = false, p = null;
    function acabar(v) { if (feito) return; feito = true; clearTimeout(tempo); try { if (p) p.destroy(); } catch (e) {} fim(v); }
    var tempo = setTimeout(function () { acabar(null); }, 8000);
    if (typeof Peer === 'undefined') { acabar(null); return; }
    try {
      p = new Peer();
      p.on('open', function () { var c = p.connect('mgo-dupla-' + cod, { reliable: true }); c.on('open', function () { acabar(true); }); });
      p.on('error', function (e) { acabar(e && e.type === 'peer-unavailable' ? false : null); });
    } catch (e) { acabar(null); }
  }
  document.getElementById('bCriar').onclick = function () { ativarGps(); criarSala(0); };
  document.getElementById('bEntrar').onclick = function () {
    var cod = document.getElementById('codSala').value.replace(/[^0-9]/g, '');
    if (cod.length !== 4) { msgIni('Digite o código de 4 números.'); return; }
    ativarGps(); entrarSala(cod);
  };
  document.getElementById('bEntrarQR').onclick = function () { ativarGps(); entrarSala(qs); };
  document.getElementById('bVoltar').onclick = function () { if (ult.pid) { net.pid = ult.pid; try { sessionStorage.setItem('mgo-pid', ult.pid); } catch (e) {} } ativarGps(); entrarSala(ult.cod); };
})();
` + s.slice(fim);
fs.writeFileSync(__dirname + '/proto-dupla.html', s);
console.log('proto-dupla.html ok', s.length);

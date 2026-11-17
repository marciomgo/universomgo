// Indicador de rede na dupla: mostra se os celulares estão ligados "direto" ou "via relay" e o atraso (ms).
// Serve pra o teste com cada um na sua rede (Wi-Fi / 5G). Idempotente; altera editar-dupla.js.
const fs = require('fs');
const arq = __dirname + '/editar-dupla.js';
let s = fs.readFileSync(arq, 'utf8');
if (s.includes('atualizarChipRede')) { console.log('já aplicado'); process.exit(0); }
const r = (a, b) => { if (!s.includes(a)) throw new Error('falta: ' + a.slice(0, 80)); s = s.replace(a, () => b); };

r('<div id="chipSala" style="display:none"></div>', '<div id="chipSala" style="display:none"></div>\n<div id="chipRede" style="display:none"></div>');
r('  #lobby{position:absolute;inset:0;z-index:31;', '  #chipRede{position:absolute;left:10px;top:44px;z-index:6;background:rgba(40,30,20,.7);color:#fff;border-radius:10px;padding:3px 10px;font-size:11px}\n  #lobby{position:absolute;inset:0;z-index:31;');

// convidado: mede o atraso e o tipo de caminho, e manda junto com a posição
r("net.tPos = setInterval(function () { net.enviar({ t: 'pos', x: POS.lat, y: POS.lng, v: vidaMineu, a: ativa, g: gpsStatus, acc: ALVO.acc || 0 }); }, 400);",
  "net.tPos = setInterval(function () { net.enviar({ t: 'pos', x: POS.lat, y: POS.lng, v: vidaMineu, a: ativa, g: gpsStatus, acc: ALVO.acc || 0, rd: net.rtt, rv: net.via }); }, 400);\n  clearInterval(net.tPing); net.tPing = setInterval(function () { net.enviar({ t: 'ping', c: performance.now() }); descobrirVia(conn); }, 3000);");
r("  else if (m.t === 'contagem') rodarContagem();", "  else if (m.t === 'contagem') rodarContagem();\n  else if (m.t === 'pong') { net.rtt = Math.round(performance.now() - m.c); atualizarChipRede(net.rtt, net.via, 'Anfitrião'); }");

// anfitrião: responde ao ping e mostra o pior atraso entre os convidados
r("  if (m.t === 'pos') { j.g = m.g; j.acc = m.acc; posDoOutro(j, m.x, m.y, m.v, m.a); }",
  "  if (m.t === 'pos') { j.g = m.g; j.acc = m.acc; j.rtt = m.rd; j.via = m.rv; posDoOutro(j, m.x, m.y, m.v, m.a); redeDoAnfitriao(); }\n  else if (m.t === 'ping') net.enviarPara(pid, { t: 'pong', c: m.c });");

r('function ligarComoConvidado(conn) {', `function atualizarChipRede(ms, via, quem) {
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
function ligarComoConvidado(conn) {`);
fs.writeFileSync(arq, s);
console.log('indicador de rede acrescentado');

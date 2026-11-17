// Correção da entrada na sala: a sala some do servidor quando a aba do criador "dorme" (ou a rede pisca) e o convidado
// vê "Não achei a sala". Agora o criador reconecta sozinho e o convidado tenta de novo com mensagens claras.
// Idempotente: roda uma vez e altera editar-dupla.js.
const fs = require('fs');
const arq = __dirname + '/editar-dupla.js';
let s = fs.readFileSync(arq, 'utf8');
if (s.includes('manterSalaViva')) { console.log('já aplicado'); process.exit(0); }

// linha de status da sala no lobby
const a0 = '  <div id="lobDica" class="lobDica"></div>';
if (!s.includes(a0)) throw new Error('lobDica');
s = s.replace(a0, () => a0 + '\n  <div id="lobStatus" class="lobDica" style="font-weight:bold"></div>');

// troca criarSala e entrarSala inteiras
const cut = (ini, fim) => { const i = s.indexOf(ini), j = s.indexOf(fim, i); if (i < 0 || j < 0) throw new Error('trecho ' + ini); return [i, j]; };
const [c0, c1] = cut('function criarSala(tent) {', 'function ouvirConexoes() {');
const novoCriar = `function statusSala(ok) { var e = document.getElementById('lobStatus'); if (!e) return; e.textContent = ok ? 'Sala no ar ✓ — mantenha esta página aberta e à frente' : 'Sala fora do ar — reconectando…'; e.style.color = ok ? '#2e7d32' : '#c62828'; }
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
`;
s = s.slice(0, c0) + novoCriar + s.slice(c1);

const [e0, e1] = cut('function entrarSala(cod) {', 'function ligarComoConvidado(conn) {');
const novoEntrar = `function entrarSala(cod, tent) {
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
`;
s = s.slice(0, e0) + novoEntrar + s.slice(e1);
fs.writeFileSync(arq, s);
console.log('entrada da sala corrigida');

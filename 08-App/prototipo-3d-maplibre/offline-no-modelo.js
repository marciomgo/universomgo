// Jogar SEM INTERNET: acrescenta ao MODELO BASE (vale pra todas as páginas): manifest/instalação, service worker, botão
// "Baixar o parque pra jogar sem internet" (mapa + arquivos do jogo guardados no celular).
// Roda uma vez (idempotente). Depois: node gerar-proto.js && node editar-dupla.js && node gerar-dupla.js
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('mgo-offline-')) { console.log('modelo já tem o offline'); process.exit(0); }
const r = (a, b) => { if (!m.includes(a)) throw new Error('modelo: falta ' + a.slice(0, 80)); m = m.replace(a, () => b); };

// 1. instalação na tela inicial (manifest por página: __MANIFESTO__ é trocado na geração)
r('<title>MGO · Protótipo do mapa 3D</title>', `<title>MGO · Protótipo do mapa 3D</title>
<link rel="manifest" href="__MANIFESTO__">
<meta name="theme-color" content="#2f6b3a">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="MGO">
<link rel="apple-touch-icon" href="apple-touch-icon.png">`);

// 2. tela inicial: botão de baixar o parque
r('<div id="inicio"><button id="bInicio">📍 Ativar GPS e bússola</button></div>',
  '<div id="inicio"><div class="cxIni2"><button id="bInicio">📍 Ativar GPS e bússola</button><button id="bOffline">⬇ Baixar o parque pra jogar sem internet</button><div id="msgOff"></div></div></div>');
r('</style>', `  .cxIni2{display:flex;flex-direction:column;align-items:center;gap:14px;width:84%;max-width:340px}
  #bOffline{width:100%;font-size:14px;font-weight:bold;padding:12px 16px;border:2px solid rgba(255,255,255,.85);border-radius:999px;background:rgba(255,255,255,.2);color:#fff;cursor:pointer;touch-action:manipulation;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  #bOffline:disabled{opacity:.6}
  #msgOff{color:#fff;font-size:13px;text-align:center;min-height:16px;text-shadow:0 1px 3px rgba(0,0,0,.7)}
</style>`);

// 3. a lógica
const fim = m.lastIndexOf('</script>');
m = m.slice(0, fim) + `
// ---------- jogar sem internet ----------
(function offline() {
  var ARM_APP = 'mgo-app-v1', ARM_MAPA = 'mgo-tiles-v1', TJ = 'https://tiles.openfreemap.org/planet';
  var CHAVE = 'mgo-offline-' + (DADOS.livre ? 'livre' : 'parque');
  if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw-mgo.js').catch(function () {}); }); }
  window.testeOffline = function (v) { // só pra teste: finge que está sem internet
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ t: 'offline-teste', v: !!v });
  };
  window.addEventListener('offline', function () { if (typeof aviso === 'function') { aviso('Sem internet: jogando com o mapa baixado.'); setTimeout(function () { aviso(''); }, 4000); } });
  var btn = document.getElementById('bOffline'), msg = document.getElementById('msgOff');
  if (!btn) return; // páginas sem o botão (ex.: dupla) só ganham o service worker
  function lerRegistro() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function mostrarRegistro() {
    var rg = lerRegistro();
    if (rg) { var d = new Date(rg.t); msg.textContent = '✓ Parque baixado em ' + d.getDate() + '/' + (d.getMonth() + 1) + ' (' + rg.mb + ' MB). Pode jogar sem internet.'; btn.textContent = '⬇ Baixar de novo (atualizar)'; }
    else msg.textContent = 'Baixe com internet (de preferência no Wi-Fi) antes de ir pro parque.';
  }
  mostrarRegistro();
  function tile(lat, lng, z) { var n = Math.pow(2, z), s = Math.sin(lat * Math.PI / 180); return [Math.floor((lng + 180) / 360 * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)]; }
  function listaTiles(c, raioM) {
    var dLat = raioM / 111320, dLng = raioM / (111320 * Math.cos(c.lat * Math.PI / 180)), out = [];
    for (var z = 11; z <= 14; z++) { var a = tile(c.lat + dLat, c.lng - dLng, z), b = tile(c.lat - dLat, c.lng + dLng, z); for (var x = a[0]; x <= b[0]; x++) for (var y = a[1]; y <= b[1]; y++) out.push([z, x, y]); }
    return out;
  }
  async function baixar() {
    if (!('caches' in window)) { msg.textContent = 'Este navegador não deixa guardar o parque.'; return; }
    if (!navigator.onLine) { msg.textContent = 'Sem internet agora. Conecte pra baixar o parque.'; return; }
    btn.disabled = true; msg.textContent = 'Baixando...';
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      var cT = await caches.open(ARM_MAPA), cA = await caches.open(ARM_APP), bytes = 0;
      var centro = DADOS.livre ? { lat: POS.lat, lng: POS.lng } : DADOS.largada, raio = DADOS.livre ? 1500 : 2000;
      var tjr = await fetch(TJ, { cache: 'reload' }); await cT.put(TJ, tjr.clone()); var tj = await tjr.json(), modelo = tj.tiles[0];
      var lista = listaTiles(centro, raio), feitos = 0;
      for (var i = 0; i < lista.length; i++) {
        var u = modelo.replace('{z}', lista[i][0]).replace('{x}', lista[i][1]).replace('{y}', lista[i][2]);
        try { var rr = await fetch(u); if (rr.ok) { bytes += (await rr.clone().blob()).size; await cT.put(u, rr); } } catch (e) {}
        feitos++; msg.textContent = 'Baixando o mapa... ' + feitos + '/' + lista.length;
      }
      // arquivos do jogo: a página, imagens e as bibliotecas que ela usa
      var arquivos = ['mineu-costas.png', 'mineu-golpe-1.png', 'mineu-golpe-2.png', 'mineu-golpe-3.png', 'mineu-estilingue-1.png', 'mineu-estilingue-2.png', 'mineu-andar-1.png', 'mineu-andar-2.png', 'mineu-andar-3.png', 'mineu-comemora.png', 'icone-pau.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', location.pathname.split('/').pop() || 'index.html'];
      var man = document.querySelector('link[rel=manifest]'); if (man) arquivos.push(man.getAttribute('href'));
      document.querySelectorAll('script[src], link[rel=stylesheet], img[src]').forEach(function (el) { var s = el.src || el.href; if (s && arquivos.indexOf(s) < 0) arquivos.push(s); });
      msg.textContent = 'Guardando o jogo no celular...';
      for (var k = 0; k < arquivos.length; k++) {
        var a = arquivos[k], externo = /^https?:\\/\\//.test(a) && a.indexOf(location.origin) !== 0;
        try { var r2 = await fetch(a, externo ? { mode: 'no-cors' } : { cache: 'reload' }); await cA.put(a, r2); } catch (e) {}
      }
      localStorage.setItem(CHAVE, JSON.stringify({ t: Date.now(), mb: Math.round(bytes / 1e5) / 10, n: lista.length }));
      mostrarRegistro();
    } catch (e) { msg.textContent = 'Não consegui baixar agora. Tente de novo com internet.'; }
    btn.disabled = false;
  }
  btn.onclick = baixar;
})();
` + m.slice(fim);
fs.writeFileSync(__dirname + '/proto-modelo.html', m);

// 4. o editar-dupla.js procura o markup antigo da tela inicial: atualiza o texto procurado
let d = fs.readFileSync(__dirname + '/editar-dupla.js', 'utf8');
const velho = `r('<div id="inicio"><button id="bInicio">📍 Ativar GPS e bússola</button></div>',`;
if (!d.includes(velho)) throw new Error('editar-dupla.js: trecho da tela inicial');
d = d.replace(velho, () => `r('<div id="inicio"><div class="cxIni2"><button id="bInicio">📍 Ativar GPS e bússola</button><button id="bOffline">⬇ Baixar o parque pra jogar sem internet</button><div id="msgOff"></div></div></div>',`);
fs.writeFileSync(__dirname + '/editar-dupla.js', d);

// 5. gerar-proto.js e gerar-dupla.js: trocam __MANIFESTO__ e escrevem um manifest por página
let g = fs.readFileSync(__dirname + '/gerar-proto.js', 'utf8');
g = g.replace("fs.writeFileSync(__dirname + '/saida/' + arq, modelo.replace('/*DADOS*/', 'const DADOS = ' + JSON.stringify(dados) + ';'));",
  "fs.writeFileSync(__dirname + '/saida/' + arq, modelo.replace('/*DADOS*/', () => 'const DADOS = ' + JSON.stringify(dados) + ';').replace('__MANIFESTO__', 'manifest-' + arq.replace('.html', '') + '.json'));\n  escreverManifest(arq);");
g = g.replace("const modelo = fs.readFileSync", `const NOMES = { 'mapa3d.html': 'MGO · Parcão', 'mapa3d-casa.html': 'MGO · Casa (teste)', 'mapa3d-livre.html': 'MGO · Livre', 'mapa3d-dupla.html': 'MGO · Dupla' };
function escreverManifest(arq) {
  const man = { name: NOMES[arq] || 'MGO', short_name: 'MGO', start_url: './' + arq, scope: './', display: 'standalone', orientation: 'portrait', background_color: '#1f5a2c', theme_color: '#2f6b3a',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] };
  fs.writeFileSync(__dirname + '/saida/manifest-' + arq.replace('.html', '') + '.json', JSON.stringify(man, null, 1));
}
const modelo = fs.readFileSync`);
fs.writeFileSync(__dirname + '/gerar-proto.js', g);
let gd = fs.readFileSync(__dirname + '/gerar-dupla.js', 'utf8');
gd = gd.replace("fs.writeFileSync(__dirname + '/saida/mapa3d-dupla.html', html);", "fs.writeFileSync(__dirname + '/saida/mapa3d-dupla.html', html.replace('__MANIFESTO__', 'manifest-mapa3d-dupla.json'));\nfs.writeFileSync(__dirname + '/saida/manifest-mapa3d-dupla.json', JSON.stringify({ name: 'MGO · Dupla', short_name: 'MGO', start_url: './mapa3d-dupla.html', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#1f5a2c', theme_color: '#2f6b3a', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));");
fs.writeFileSync(__dirname + '/gerar-dupla.js', gd);
console.log('offline aplicado ao modelo, editar-dupla.js e geradores');

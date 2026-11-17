// Traz os desenhos oficiais do jogo 2D (pontos numerados, cura, pedras, bombas) pro MODELO BASE (vale pra todas as páginas).
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('ICONES_NUMERADOS')) { console.log('já aplicado'); process.exit(0); }
const r = (a, b) => { if (!m.includes(a)) throw new Error('falta ' + a.slice(0, 70)); m = m.replace(a, () => b); };
const ids = ['48f7c1d977754b23977fd2e7f58c6c27','f14858e9c66d43feae48eff43148759e','cba7ab04f17845d98a60cbdb48466302','ea984cd4c0fc44aead08ba7a5af6b383','6a69d7baa0794d37848b3948fed51e44','801dffdc2e554552a5c134e097d91ea6','cd0ee07d3fcd40fb9a33810c88f2d851','91b88885a5c44c8c833417bc1190b7b5','1b89172049664af79ec14bce19a83033','033f68da0d1044bcbd9a97da09181820','193c340555f24225b4d92d767d84255a','1ff212affeb84c9584f484f04ba0535e','741fb6aae44744de8ed6e009fb318faf','b1b9ad3701be4696815636ec5dc6cedc','ed5489163f5f4182b136c62a8f93eb33','7ccdf03c1f824bea8af5c7f17a999e96','c8fe0d4b091b49f7aba79ef064ecfbae','77ea1b50292947b7adb0c8eac523973d','4695d3ce6947477ca8a54cf26fda87c6','5bc20c9e31a9428980ffd69a42beb7bb','514f5fbaf6134390b721277b01a65366','4c05aa018fc8463393cd0d9f0d63e102','8530ccc59ad743e78a7ad6977226335e','e692002f886449efb41c97bf50166f45','81eaeefadf2744878569f4cb8b6d73f1','c2baf60987ef4598af4bdc0d73e2fbd9','845aec3fa20e4ff595646def8a93b08c','009e01b80a6e4289adcbe915449e9652','37e8e810d5c248b5893ee19c8bceeba5','d2909286d264450c9c8321282b3e2c9e'];
// CSS: igual ao 2D (ponto = imagem; bomba e pedra = emoji solto; cura = cruz branca em círculo vermelho)
r(`  .p-ponto .bola{width:34px;height:34px;background:#2979ff;font-size:15px}
  .p-cura .bola{width:30px;height:30px;background:#e53935;font-size:18px}
  .p-pedra .bola{width:24px;height:24px;background:#eceff1;font-size:14px;border-color:#90a4ae}
  .p-pedra.esp .bola{background:#fff3c4;border-color:#f9a825}
  .p-bomba .bola{width:26px;height:26px;background:#212121;font-size:15px;border-color:#fff}`,
`  .p-ponto .bola{width:44px;height:44px;background:none;border:0;border-radius:0}
  .p-ponto .bola img{width:44px;height:44px;display:block}
  .p-cura .bola{width:32px;height:32px;box-sizing:border-box;background:#c0392b;font-size:20px;border:2px solid #fff}
  .p-pedra .bola{width:34px;height:34px;background:none;border:0;border-radius:0;font-size:28px}
  .p-bomba .bola{width:34px;height:34px;background:none;border:0;border-radius:0;font-size:28px}`);
r(`DADOS.pontos.forEach(function (p) { pino('p-ponto', p.n, p.lat, p.lng); });`,
`var ICONES_NUMERADOS = ${JSON.stringify(ids.map(i => 'https://static.wixstatic.com/media/f02643_' + i + '~mv2.png'))}; // desenhos oficiais do jogo, 1 a 30
  DADOS.pontos.forEach(function (p) { var u = ICONES_NUMERADOS[(p.n || 1) - 1]; pino('p-ponto', u ? '<img src="' + u + '" alt="' + p.n + '">' : p.n, p.lat, p.lng); });`);
// baixar o parque também guarda os 30 desenhos
r(`'icone-pau.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', location.pathname`, `'icone-pau.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].concat(typeof ICONES_NUMERADOS !== 'undefined' ? ICONES_NUMERADOS : []).concat([location.pathname`);
r(`.pop() || 'index.html'];`, `.pop() || 'index.html']);`);
// zoom padrão: 2 cliques no + (0,4 cada) a mais
r(`zoom = 19.4;`, `zoom = 20.2;`);
fs.writeFileSync(__dirname + '/proto-modelo.html', m);
console.log('ok');

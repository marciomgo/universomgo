// Liga no MODO LIVRE (e so nele) os monstros 3D (camada3d.js + modelos .gltf) e o joystick na tela (joystick-livre.js). Idempotente: pode rodar varias vezes.
// Uso: node camada3d-instalar.js            -> prototipo-3d-maplibre/saida/mapa3d-livre.html
//      node camada3d-instalar.js <pasta>    -> outra pasta (ex.: a docs/ do site), no mapa3d-livre.html dela
// Tambem e chamado pelo gerar-proto.js a cada geracao.
const fs = require('fs'), path = require('path');
const MODELOS = path.join(__dirname, '..', 'mgo3d', 'modelos-3d', 'ultimate-monsters');
const MARCA_3D = '<!--MONSTROS-3D-->', MARCA_JOY = '<!--JOYSTICK-LIVRE-->';
const BLOCO_3D = MARCA_3D + '\n<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>\n<script type="module" src="camada3d.js"></script>\n';
const BLOCO_JOY = MARCA_JOY + '\n<script src="joystick-livre.js"></script>\n';
function instalar(pasta) {
  const destino = pasta || path.join(__dirname, 'saida');
  const f = path.join(destino, 'mapa3d-livre.html');
  let h = fs.readFileSync(f, 'utf8');
  if (!h.includes('</body>')) throw new Error('sem </body>');
  if (!h.includes(MARCA_3D)) h = h.replace('</body>', () => BLOCO_3D + '</body>');
  if (!h.includes(MARCA_JOY)) h = h.replace('</body>', () => BLOCO_JOY + '</body>');
  fs.writeFileSync(f, h);
  ['camada3d.js', 'joystick-livre.js'].forEach((n) => fs.copyFileSync(path.join(__dirname, n), path.join(destino, n)));
  fs.mkdirSync(path.join(destino, 'modelos'), { recursive: true });
  ['Demon.gltf', 'Orc_Skull.gltf'].forEach((n) => fs.copyFileSync(path.join(MODELOS, n), path.join(destino, 'modelos', n)));
  console.log('modo livre: 3D + joystick ligados em ' + f);
}
module.exports = instalar;
if (require.main === module) instalar(process.argv[2]);

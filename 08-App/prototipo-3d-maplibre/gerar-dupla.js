// Gera a página da missão em dupla (cópia separada; não mexe nas páginas prontas)
const fs = require('fs');
const c = require('./dados/casa3.json');
const dados = { largada: c.largada, pontos: [], curas: [], pedras: [], bombas: [], chefoes: [], zumbis: [], livre: true, dupla: true };
const html = fs.readFileSync(__dirname + '/proto-dupla.html', 'utf8').replace('/*DADOS*/', () => 'const DADOS = ' + JSON.stringify(dados) + ';');
fs.writeFileSync(__dirname + '/saida/mapa3d-dupla.html', html.replace('__MANIFESTO__', 'manifest-mapa3d-dupla.json'));
fs.writeFileSync(__dirname + '/saida/manifest-mapa3d-dupla.json', JSON.stringify({ name: 'MGO · Dupla', short_name: 'MGO', start_url: './mapa3d-dupla.html', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#1f5a2c', theme_color: '#2f6b3a', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));
console.log('ok mapa3d-dupla.html', html.length);

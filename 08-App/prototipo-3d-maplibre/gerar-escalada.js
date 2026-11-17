// Gera as páginas de teste "rocha escalável + sarabatana": (1) Parcão (dados do Combate 1) e (2) modo livre (rocha a ~26 m de onde o jogo começa).
const fs = require('fs');
const modelo = fs.readFileSync(__dirname + '/proto-escalada.html', 'utf8');
const rad = Math.PI / 180;
const em = (p, m, ang) => ({ lat: p.lat + (m * Math.cos(ang * rad)) / 111320, lng: p.lng + (m * Math.sin(ang * rad)) / (111320 * Math.cos(p.lat * rad)) });
function dadosDe(arq) { return JSON.parse(fs.readFileSync(__dirname + '/saida/' + arq, 'utf8').match(/const DADOS = (.*);/)[1]); }
function escrever(arq, nome, dados) {
  const man = 'manifest-' + arq.replace('.html', '') + '.json';
  fs.writeFileSync(__dirname + '/saida/' + arq, modelo.replace('/*DADOS*/', () => 'const DADOS = ' + JSON.stringify(dados) + ';').replace('__MANIFESTO__', man));
  fs.writeFileSync(__dirname + '/saida/' + man, JSON.stringify({ name: nome, short_name: 'MGO', start_url: './' + arq, scope: './', display: 'standalone', orientation: 'portrait', background_color: '#1f5a2c', theme_color: '#2f6b3a', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 1));
  console.log('ok', arq);
}
// 1. Parcão
const parc = dadosDe('mapa3d-combate-1.html');
parc.rocha = Object.assign(em(parc.largada, 22, 100), { req: 'escalada' });
escrever('mapa3d-escalada.html', 'MGO · Escalada no Parcão (teste)', parc);
// 2. modo livre (a rocha é colocada pelo jogo, em volta de onde começa)
escrever('mapa3d-escalada-livre.html', 'MGO · Escalada no modo livre (teste)', dadosDe('mapa3d-livre.html'));

// UNICO LUGAR que liga blocos nas paginas do jogo. Le blocos/blocos.json.
// O modelo do jogo (proto-modelo.html) declara o encaixe <!--BLOCOS--> antes de </body>; aqui ele e preenchido conforme o MODO da pagina.
// Uso (nos builds):  const { montarBlocos } = require('.../prototipo-3d-maplibre/montar-blocos.js');
//                    html = montarBlocos(html, 'combate', pastaDeSaida);
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'blocos');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(DIR, 'blocos.json'), 'utf8'));
const ENCAIXE = '<!--BLOCOS-->';

function montarBlocos(html, modo, pastaSaida) {
  const nomes = CATALOGO.modos[modo];
  if (!nomes) throw new Error('montar-blocos: modo desconhecido "' + modo + '" (modos: ' + Object.keys(CATALOGO.modos).filter((k) => k[0] !== '_').join(', ') + ')');
  if (!html.includes(ENCAIXE)) throw new Error('montar-blocos: o modelo nao tem o encaixe ' + ENCAIXE);
  const bibs = new Set(), estilos = [], scripts = [], copias = [], ativos = { proprios: [], externos: [], modulos: [] };
  nomes.forEach((n) => {
    const b = CATALOGO.blocos[n]; if (!b) throw new Error('montar-blocos: bloco "' + n + '" nao existe no catalogo');
    (b.usaBibliotecas || []).forEach((x) => bibs.add(x));
    if (b.css) estilos.push('<style>/* bloco ' + n + ' */\n' + fs.readFileSync(path.join(DIR, b.css), 'utf8').trim() + '\n</style>');
    if (b.js) { scripts.push('<script' + (b.modulo ? ' type="module"' : '') + ' src="' + b.js + '"></script>'); copias.push({ de: path.join(DIR, b.js), para: b.js }); ativos.proprios.push(b.js); }
    (b.ativos || []).forEach((a) => { copias.push({ de: path.resolve(__dirname, a.de), para: a.para }); ativos.proprios.push(a.para); });
    (b.offline || []).forEach((u) => ativos.externos.push(u));
    (b.modulosParaAquecer || []).forEach((m) => ativos.modulos.push(m));
  });
  const mapa = bibs.size ? '<script type="importmap">' + JSON.stringify({ imports: Object.fromEntries([...bibs].map((x) => [x, CATALOGO.bibliotecas[x]])) }) + '</script>' : '';
  const listaAtivos = '<script>window.MGO_ATIVOS=' + JSON.stringify(ativos) + ';</script>'; // o 'Baixar o parque' guarda tambem estes arquivos
  const bloco = nomes.length ? '<!-- blocos do modo "' + modo + '": ' + nomes.join(', ') + ' -->\n' + [].concat(estilos, mapa ? [mapa] : [], [listaAtivos], scripts).join('\n') + '\n' : '';
  (CATALOGO.nucleo || []).forEach((n) => copias.push({ de: path.join(__dirname, n), para: n }));
  if (pastaSaida) copias.forEach((c) => { const alvo = path.join(pastaSaida, c.para); fs.mkdirSync(path.dirname(alvo), { recursive: true }); fs.copyFileSync(c.de, alvo); });
  return html.replace(ENCAIXE, () => bloco);
}
module.exports = { montarBlocos, CATALOGO };

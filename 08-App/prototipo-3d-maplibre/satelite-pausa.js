// Vista de satélite = jogo PAUSADO (só pra olhar de cima; zoom continua livre). No modelo base; na dupla o mundo é de todos, então não congela.
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('function congelado')) { console.log('já aplicado'); process.exit(0); }
const r = (a, b) => { if (!m.includes(a)) throw new Error('falta ' + a.slice(0, 70)); m = m.replace(a, () => b); };
r(`function quadro(agora) {`, `function congelado() { return satelite && !DADOS.dupla; } /* vista de cima = jogo parado */
function quadro(agora) {`);
r(`    if (tecla.esq) heading -= 110 * dt;
    if (tecla.dir) heading += 110 * dt;
    var v = (tecla.anda ? 1 : 0) - (tecla.volta ? 0.6 : 0);`, `    var par = congelado();
    if (tecla.esq && !par) heading -= 110 * dt;
    if (tecla.dir && !par) heading += 110 * dt;
    var v = par ? 0 : (tecla.anda ? 1 : 0) - (tecla.volta ? 0.6 : 0);`);
r(`  moverInimigos(dt, agora);
  atualizarMira();`, `  if (!congelado()) moverInimigos(dt, agora);
  atualizarMira();`);
r(`document.getElementById("btnAtirar").onclick = function () { if (ativa === "galho")`, `document.getElementById("btnAtirar").onclick = function () { if (congelado()) return; if (ativa === "galho")`);
r(`elTroca.onclick = function () { ativa =`, `elTroca.onclick = function () { if (congelado()) return; ativa =`);
// aviso + botões apagados
r(`  pintaInc();
};
mapa.addControl(new maplibregl.ScaleControl`, `  pintaInc();
  document.body.classList.toggle('sat-pausa', congelado());
};
mapa.addControl(new maplibregl.ScaleControl`);
r(`</style>`, `  #pausaSat{display:none;position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:6;background:rgba(30,40,50,.82);color:#fff;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:bold;white-space:nowrap;pointer-events:none}
  body.sat-pausa #pausaSat{display:block}
  body.sat-pausa #controles, body.sat-pausa #trocaPedraWrap{opacity:.3;pointer-events:none}
</style>`);
r(`<div id="aviso"`, `<div id="pausaSat">⏸ Vista de cima — jogo pausado</div><div id="aviso"`);
fs.writeFileSync(__dirname + '/proto-modelo.html', m);
console.log('ok');

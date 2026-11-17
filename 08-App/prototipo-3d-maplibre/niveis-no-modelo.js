// 10 níveis no modo livre (e na dupla): a cada nível +20% de zumbis e de chefões. Vencer = próximo nível; vencer o 10 = volta ao 1.
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('NIVEL_MAX')) { console.log('modelo já tem os níveis'); }
else {
  const r = (a, b) => { if (m.split(a).length !== 2) throw new Error('falta ' + a.slice(0, 80)); m = m.replace(a, () => b); };
  r(`function spawnBase(lat, lng) {
  estat = { zumbis: 0, monstros: 0, t0: performance.now() }; celebrou = false;
  limparInimigos();`, `// ---------- níveis do modo livre: +20% de zumbis e de chefões a cada nível (10 níveis) ----------
var NIVEL = 1, NIVEL_MAX = 10, CRESCE_NIVEL = 1.2, TETO_ZUMBIS_NIVEL = 60, venceuNivel = false; /* teto de zumbis: celular fraco */
function pintaNivel() { var t = document.getElementById('nivelTag'); if (t) { t.style.display = DADOS.livre ? 'block' : 'none'; t.textContent = 'Nível ' + NIVEL + ' de ' + NIVEL_MAX; } }
function spawnBase(lat, lng) {
  if (venceuNivel) { NIVEL = NIVEL >= NIVEL_MAX ? 1 : NIVEL + 1; venceuNivel = false; }
  pintaNivel();
  estat = { zumbis: 0, monstros: 0, t0: performance.now() }; celebrou = false;
  limparInimigos();`);
  r(`  atualizarZonas(chefoes);
}

mapa.on('load', function () {`, `  if (NIVEL > 1) { // níveis seguintes: mais zumbis soltos e mais chefões comuns, até 70 m do centro
    var mult = Math.pow(CRESCE_NIVEL, NIVEL - 1), nz0 = inimigos.length - chefoes.length;
    var zAlvo = Math.min(TETO_ZUMBIS_NIVEL, Math.round(nz0 * mult)), cAlvo = Math.round(mult) - 1;
    for (var q = nz0; q < zAlvo; q++) { var ze = pontoLivre(lat, lng, 14 + Math.random() * 56, Math.random() * 360); novoInimigo(ze.lat, ze.lng, 'p-zumbi', '🧟', 5); }
    for (var c2 = 0; c2 < cAlvo; c2++) { var ce = pontoLivre(lat, lng, 40 + Math.random() * 35, Math.random() * 360); chefoes.push({ lat: ce.lat, lng: ce.lng, final: false }); novoInimigo(ce.lat, ce.lng, 'p-chefao', '👹', 25); }
  }
  atualizarZonas(chefoes);
}

mapa.on('load', function () {`);
  // tela de vitória: "Nível N cumprido" / botão "Próximo nível"
  r(`  document.getElementById('pTempo').textContent = mm + ':' + ss;
  document.getElementById('parabens').style.display = 'flex';`, `  document.getElementById('pTempo').textContent = mm + ':' + ss;
  if (DADOS.livre) {
    venceuNivel = true; var ult = NIVEL >= NIVEL_MAX;
    document.querySelector('#parabens h2').textContent = ult ? 'Os ' + NIVEL_MAX + ' níveis cumpridos!' : 'Nível ' + NIVEL + ' cumprido!';
    document.querySelector('#parabens .caixaP > p').textContent = ult ? 'Você derrotou todos os monstros dos 10 níveis. Incrível!' : 'Todos os zumbis e monstros foram derrotados. No próximo vêm 20% a mais!';
    document.getElementById('bDeNovo').textContent = ult ? 'Jogar de novo (nível 1)' : 'Próximo nível ➜';
  }
  document.getElementById('parabens').style.display = 'flex';`);
  r(`<div id="foraArea">`, `<div id="nivelTag" style="display:none"></div><div id="foraArea">`);
  r(`  #foraArea{`, `  #nivelTag{position:absolute;left:10px;top:12px;z-index:6;background:rgba(30,40,50,.78);color:#fff;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:bold;pointer-events:none}
  #foraArea{`);
  fs.writeFileSync(__dirname + '/proto-modelo.html', m); console.log('modelo ok');
}
let d = fs.readFileSync(__dirname + '/editar-dupla.js', 'utf8');
if (!d.includes('m.nv')) {
  const a1 = "return { t: 'estado', r: rodada, ar:", b1 = "return { t: 'estado', r: rodada, nv: NIVEL, ar:";
  const a2 = "  if (m.ar) definirAreaLivre(m.ar[0], m.ar[1]);", b2 = "  if (m.ar) definirAreaLivre(m.ar[0], m.ar[1]);\n  if (m.nv && m.nv !== NIVEL) { NIVEL = m.nv; pintaNivel(); }";
  if (d.split(a1).length !== 2 || d.split(a2).length !== 2) throw new Error('dupla');
  d = d.replace(a1, () => b1).replace(a2, () => b2); fs.writeFileSync(__dirname + '/editar-dupla.js', d); console.log('dupla ok');
}

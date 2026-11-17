// Musiquinha de fundo do modo livre (e da dupla): gerada no próprio celular (sem arquivo, sem direitos autorais). Calma, em loop, com botão 🎵 pra desligar.
const fs = require('fs');
let m = fs.readFileSync(__dirname + '/proto-modelo.html', 'utf8');
if (m.includes('MUSICA_BPM')) { console.log('já tem música'); process.exit(0); }
const marca = '// ---------- jogar sem internet ----------';
if (m.split(marca).length !== 2) throw new Error('marca');
const codigo = `// ---------- musiquinha de fundo (modo livre e dupla) ----------
/* Passeio tranquilo em dó maior: acordes C - Am - F - G, melodia suave em escala pentatônica, baixo macio e um eco leve. Tudo sintetizado aqui. */
var MUSICA_BPM = 84, MUSICA_VOL = 0.09;
var MUSICA = (function () {
  var NOTA = function (n) { return 440 * Math.pow(2, (n - 69) / 12); }; /* n = número MIDI */
  var ACORDES = [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [55, 59, 62]]]; /* [baixo, notas do acorde] */
  var _ = null;
  var FRASES = [
    [76, _, 79, _, 81, 79, _, 76, 74, _, 76, _, 72, _, _, _],
    [79, _, 76, 74, _, 72, _, 74, 76, _, _, 79, _, 76, _, _],
    [72, _, 74, 76, _, 79, _, 76, 74, _, 72, _, 74, _, _, _],
    [81, _, 79, _, 76, _, 79, 81, 79, _, _, 76, 74, _, 72, _]
  ];
  var ORDEM = [0, 1, 0, 2, 1, 3, 0, 2]; /* 8 compassos de 16 colcheias... 2 voltas pelos 4 acordes */
  function nota(ctx, dest, tipo, freq, t, dur, pico, ataque, filtro) {
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = tipo; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = filtro || 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pico, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    PASSOS: 16 * 8, /* uma volta inteira = 8 blocos de 16 colcheias */
    dur: function () { return 60 / MUSICA_BPM / 2; }, /* uma colcheia, em segundos */
    agendar: function (ctx, dest, eco, passo, t) { /* toca o que acontece na colcheia "passo" da volta, no instante t */
      var bloco = Math.floor(passo / 16) % 8, p = passo % 16, ac = ACORDES[bloco % 4], d = 60 / MUSICA_BPM / 2;
      if (p === 0) { /* base do acorde: duas notas sustentadas bem suaves */
        ac[1].forEach(function (n, k) { nota(ctx, dest, 'sine', NOTA(n), t + k * 0.03, d * 16, 0.22, 1.2, 900); });
      }
      if (p === 0 || p === 8) nota(ctx, dest, 'triangle', NOTA(ac[0] + 12), t, d * 4, 0.34, 0.02, 600);
      if (p === 12) nota(ctx, dest, 'triangle', NOTA(ac[0] + 19), t, d * 2.5, 0.16, 0.02, 600);
      var mel = FRASES[ORDEM[bloco]][p];
      if (mel !== null) { var dest2 = eco || dest; nota(ctx, dest2, 'triangle', NOTA(mel), t, d * 3.2, 0.42, 0.012, 2600); if (eco) nota(ctx, dest, 'triangle', NOTA(mel), t, d * 3.2, 0.3, 0.012, 2600); }
    }
  };
})();
var musicaNo = { ligada: false, mestre: null, eco: null, passo: 0, proximo: 0, timer: null, ctx: null, mudo: false };
try { musicaNo.mudo = localStorage.getItem('mgo-musica') === '0'; } catch (e) {}
function montarMusica(ctx) {
  var mestre = ctx.createGain(); mestre.gain.value = MUSICA_VOL; mestre.connect(ctx.destination);
  var eco = ctx.createDelay(1); eco.delayTime.value = 60 / MUSICA_BPM * 0.75;
  var fb = ctx.createGain(); fb.gain.value = 0.32; var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  var mix = ctx.createGain(); mix.gain.value = 0.5;
  eco.connect(lp); lp.connect(fb); fb.connect(eco); lp.connect(mix); mix.connect(mestre);
  return { mestre: mestre, eco: eco };
}
function ciclo() {
  var ctx = obterAudio(); if (!ctx || !musicaNo.ligada) return;
  if (ctx !== musicaNo.ctx) { musicaNo.ctx = ctx; var n = montarMusica(ctx); musicaNo.mestre = n.mestre; musicaNo.eco = n.eco; musicaNo.proximo = ctx.currentTime + 0.1; }
  if (ctx.state !== 'running') return;
  var agora = ctx.currentTime, d = MUSICA.dur();
  if (musicaNo.proximo < agora) musicaNo.proximo = agora + 0.05; /* ficou parada (tela apagou): recomeça sem tentar recuperar o tempo perdido */
  while (musicaNo.proximo < agora + 0.5) { MUSICA.agendar(ctx, musicaNo.mestre, musicaNo.eco, musicaNo.passo % MUSICA.PASSOS, musicaNo.proximo); musicaNo.passo++; musicaNo.proximo += d; }
}
function ligarMusica() {
  if (!DADOS.livre || musicaNo.mudo || musicaNo.ligada) return;
  musicaNo.ligada = true; ciclo(); musicaNo.timer = setInterval(ciclo, 150);
}
function desligarMusica() { musicaNo.ligada = false; if (musicaNo.timer) { clearInterval(musicaNo.timer); musicaNo.timer = null; } if (musicaNo.mestre) { try { musicaNo.mestre.gain.cancelScheduledValues(0); musicaNo.mestre.disconnect(); } catch (e) {} musicaNo.mestre = null; musicaNo.ctx = null; } }
function baixarMusica(seg) { /* some a música por uns segundos (ex.: na fanfarra da vitória) */
  if (!musicaNo.mestre || !musicaNo.ctx) return; var g = musicaNo.mestre.gain, t = musicaNo.ctx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(MUSICA_VOL * 0.12, t + 0.4); g.linearRampToValueAtTime(MUSICA_VOL, t + seg);
}
if (DADOS.livre) {
  var bMus = document.createElement('button'); bMus.id = 'bMusica'; bMus.title = 'Música de fundo'; bMus.textContent = musicaNo.mudo ? '🔇' : '🎵';
  document.getElementById('painel').appendChild(bMus);
  bMus.onclick = function () {
    musicaNo.mudo = !musicaNo.mudo; try { localStorage.setItem('mgo-musica', musicaNo.mudo ? '0' : '1'); } catch (e) {}
    bMus.textContent = musicaNo.mudo ? '🔇' : '🎵';
    if (musicaNo.mudo) desligarMusica(); else ligarMusica();
  };
  /* navegador só deixa tocar depois de um toque: liga no primeiro toque em qualquer lugar */
  var primeiroToque = function () { document.removeEventListener('pointerdown', primeiroToque, true); ligarMusica(); };
  document.addEventListener('pointerdown', primeiroToque, true);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && musicaNo.ligada) ciclo(); });
  var celebrarMus = celebrar; celebrar = function () { celebrarMus(); baixarMusica(6); };
}
`;
m = m.replace(marca, () => codigo + '\n' + marca);
fs.writeFileSync(__dirname + '/proto-modelo.html', m);
console.log('ok');

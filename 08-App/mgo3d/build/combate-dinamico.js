// LARGADA LIVRE: monta o combate em volta de ONDE A PESSOA ESTA (dentro do parque). Roda no navegador (sem bibliotecas) e tambem no Node (para testar).
// A CADA LARGADA o percurso e SORTEADO (mesmo largando do mesmo lugar sai um caminho diferente: ora para um lado, ora para outro).
// So DEPOIS de escolhido o percurso entram as curas, pedras e bombas, perto dele e em NUMERO FIXO (conteudo/combate-teste.json -> itens).
// Entrada: L = { lat, lng }; A = { pontos, itens, bombas, segura } (piscinas de locais validos: listas de [lat,lng]); R = { bases, monstros, itens };
//          rnd = funcao de sorteio 0..1 (opcional; no jogo e Math.random, nos testes uma semente fixa).
// Saida: { pontos, zumbis, chefoes, curas, pedras, bombas } no mesmo formato do DADOS, ou null se nao achar onde montar as bases.
function gerarCombateDinamico(L, A, R, rnd) {
  rnd = rnd || Math.random;
  var rad = Math.PI / 180;
  function nz(l) { return (l || []).map(function (p) { return Array.isArray(p) ? { lat: p[0], lng: p[1] } : p; }); }
  function dist(a, b) { var dl = (b.lat - a.lat) * 111320, dn = (b.lng - a.lng) * 111320 * Math.cos(a.lat * rad); return Math.sqrt(dl * dl + dn * dn); }
  function em(p, m, ang) { return { lat: p.lat + (m * Math.cos(ang * rad)) / 111320, lng: p.lng + (m * Math.sin(ang * rad)) / (111320 * Math.cos(p.lat * rad)) }; }
  function noAnel(p, r) { var d = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > p.lat) !== (yj > p.lat)) && (p.lng < (xj - xi) * (p.lat - yi) / (yj - yi) + xi)) d = !d; } return d; }
  function naSegura(p) {
    var g = A.segura; if (!g) return true;
    var polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (var i = 0; i < polys.length; i++) { if (noAnel(p, polys[i][0])) { var buraco = false; for (var k = 1; k < polys[i].length; k++) if (noAnel(p, polys[i][k])) buraco = true; if (!buraco) return true; } }
    return false;
  }
  function distSeg(p, a, b) { // metros do ponto p ate o segmento a-b
    var c = Math.cos(p.lat * rad), ax = (a.lng - p.lng) * 111320 * c, ay = (a.lat - p.lat) * 111320, bx = (b.lng - p.lng) * 111320 * c, by = (b.lat - p.lat) * 111320;
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    var qx = ax + t * dx, qy = ay + t * dy; return Math.sqrt(qx * qx + qy * qy);
  }
  function distRota(p, linha) { var m = 1e9; for (var i = 0; i < linha.length - 1; i++) { var d = distSeg(p, linha[i], linha[i + 1]); if (d < m) m = d; } return m; }
  function sorteia(v) { return v[Math.floor(rnd() * v.length)]; }
  var PP = nz(A.pontos), PI = nz(A.itens), PB = nz(A.bombas);
  var B = R.bases, M = R.monstros, I = R.itens;

  // 1) PERCURSO SORTEADO: a 1a base fica a uns 80 m em QUALQUER direcao (sorteada); cada uma das outras e uma das 4 mais proximas da anterior (sorteada)
  function escolheRota(cand) {
    var janela = cand.filter(function (p) { return Math.abs(dist(p, L) - B.alvoDaPrimeiraM) <= 35; });
    if (!janela.length) { janela = cand.slice().sort(function (a, b) { return Math.abs(dist(a, L) - B.alvoDaPrimeiraM) - Math.abs(dist(b, L) - B.alvoDaPrimeiraM); }).slice(0, 6); }
    var rota = [sorteia(janela)], atual = rota[0];
    while (rota.length < B.quantidade) {
      var livres = cand.filter(function (p) { return rota.every(function (r) { return dist(p, r) >= B.distMinEntreBasesM; }); });
      if (!livres.length) break;
      livres.sort(function (a, b) { return dist(a, atual) - dist(b, atual); });
      atual = sorteia(livres.slice(0, 4)); rota.push(atual);
    }
    return rota;
  }
  var rota = [];
  for (var raio = B.raioMaxDaLargadaM; raio <= 420 && rota.length < B.quantidade; raio += 40) {
    var cand = PP.filter(function (p) { var d = dist(p, L); return d >= B.distMinDaLargadaM && d <= raio; });
    if (!cand.length) continue;
    for (var tent = 0; tent < 10 && rota.length < B.quantidade; tent++) { var r = escolheRota(cand); if (r.length > rota.length) rota = r; }
  }
  if (!rota.length) return null;
  var linha = [L].concat(rota);

  // 2) monstros: tentam o angulo/distancia pedidos e, se cairem fora da area segura, recuam
  function posicao(base, m, ang) {
    var fs = [1, 0.75, 0.5];
    for (var f = 0; f < fs.length; f++) for (var k = 0; k < 12; k++) { var p = em(base, m * fs[f], ang + k * 30); if (naSegura(p)) return p; }
    return null;
  }
  var zumbis = [], chefoes = [];
  rota.forEach(function (b, i) {
    var n = M.zumbisPorBase, ult = i === rota.length - 1;
    for (var k = 0; k < n; k++) { var p = posicao(b, M.zumbiDistDaBaseM, (360 / n) * k + i * 40 + 20); if (p) zumbis.push(p); }
    if (M.chefaoEmCadaBase) { var c = posicao(b, M.chefaoDistDaBaseM, 70 + i * 55); if (c) chefoes.push({ lat: c.lat, lng: c.lng, final: false }); }
    if (ult) { var f2 = posicao(b, M.chefaoFinalDistDaBaseM, 250); if (f2) chefoes.push({ lat: f2.lat, lng: f2.lng, final: true }); }
  });

  // 3) ITENS DEPOIS DO PERCURSO, em numero FIXO: os itens de cada tipo sao distribuidos ao longo do caminho (um por trecho), cada um num local valido perto dele
  var comp = 0, trechos = [];
  for (var s = 0; s < linha.length - 1; s++) { var ds = dist(linha[s], linha[s + 1]); trechos.push(ds); comp += ds; }
  function noCaminho(t) { // ponto a t (0..1) do comprimento total do percurso
    var alvo = Math.max(0, Math.min(1, t)) * comp, acum = 0;
    for (var s2 = 0; s2 < trechos.length; s2++) { if (acum + trechos[s2] >= alvo || s2 === trechos.length - 1) { var f3 = trechos[s2] ? (alvo - acum) / trechos[s2] : 0; return { lat: linha[s2].lat + (linha[s2 + 1].lat - linha[s2].lat) * f3, lng: linha[s2].lng + (linha[s2 + 1].lng - linha[s2].lng) * f3 }; } acum += trechos[s2]; }
    return linha[0];
  }
  var usados = rota.slice();
  function livre(p) { return usados.every(function (q) { return dist(p, q) >= (I.distEntreItensM || 12); }); }
  function colocar(pool, n, fase, maxRota) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var ancora = noCaminho((i + fase) / n), achado = null;
      var etapas = [[45, maxRota], [80, maxRota], [130, maxRota], [220, maxRota * 1.6], [400, maxRota * 2.5]];
      for (var e = 0; e < etapas.length && !achado; e++) {
        var cs = pool.filter(function (p) { return dist(p, ancora) <= etapas[e][0] && distRota(p, linha) <= etapas[e][1] && livre(p); });
        if (cs.length) { cs.sort(function (a, b) { return dist(a, ancora) - dist(b, ancora); }); achado = sorteia(cs.slice(0, 4)); }
      }
      if (achado) { out.push(achado); usados.push(achado); }
    }
    return out;
  }
  function qtd(porBase, fixo) { return porBase !== undefined ? Math.round(rota.length * porBase) : fixo; } // numero de itens: por base (cresce com o percurso) ou fixo
  // BOMBAS: uma no MEIO de cada trecho em linha reta (largada->base 1, base 1->base 2...), ou no ponto de trilha/area mais proximo desse meio. Entram primeiro: tem prioridade no lugar.
  var nB = qtd(I.bombasPorBase, I.bombas), maxB = I.distMaxBombasM || I.distMaxDaRotaM, bombas = [];
  for (var q = 0; q < nB && q < linha.length - 1; q++) {
    var meio = { lat: (linha[q].lat + linha[q + 1].lat) / 2, lng: (linha[q].lng + linha[q + 1].lng) / 2 }, melhorB = null, mdB = 1e9;
    PB.forEach(function (p) { var d = dist(p, meio); if (d < mdB && d <= maxB && livre(p)) { mdB = d; melhorB = p; } });
    if (melhorB) { bombas.push(melhorB); usados.push(melhorB); }
  }
  if (bombas.length < nB) bombas = bombas.concat(colocar(PB, nB - bombas.length, 0.75, maxB)); // faltou lugar no meio (ou mais bombas que trechos): completa perto do percurso
  var curas = colocar(PI, qtd(I.curasPorBase, I.curas), 0.25, I.distMaxDaRotaM);
  var pedras = colocar(PI, qtd(I.pedrasPorBase, I.pedras), 0.5, I.distMaxDaRotaM);
  return {
    pontos: rota.map(function (p, i) { return { n: i + 1, lat: p.lat, lng: p.lng }; }),
    zumbis: zumbis.map(function (z) { return { lat: z.lat, lng: z.lng }; }),
    chefoes: chefoes,
    curas: curas.map(function (p) { return { lat: p.lat, lng: p.lng }; }),
    pedras: pedras.map(function (p) { return { lat: p.lat, lng: p.lng, esp: false }; }),
    bombas: bombas.map(function (p, i) { return { lat: p.lat, lng: p.lng, e: I.emojisBomba[i % I.emojisBomba.length] }; })
  };
}
if (typeof module !== 'undefined') module.exports = gerarCombateDinamico;

// LARGADA LIVRE: monta o combate em volta de ONDE A PESSOA ESTA (dentro do parque), a partir da arena (piscina de pontos, curas, pedras, bombas e a area segura).
// Roda no navegador (sem bibliotecas) e tambem no Node (para testar). Mesma regra do build, so que com a largada = posicao do jogador.
// Entrada: L = { lat, lng }; A = { pontos, curas, pedras, bombas, segura }; R = { bases, monstros, itens } (conteudo/combate-teste.json).
// Saida: { pontos, zumbis, chefoes, curas, pedras, bombas } no mesmo formato do DADOS, ou null se nao achar onde montar as bases.
function gerarCombateDinamico(L, A, R) {
  var rad = Math.PI / 180;
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
  function espalhar(c, n) { // n itens bem espalhados: o proximo e sempre o mais longe dos ja escolhidos
    if (c.length <= n) return c.slice();
    var esc = [c[0]];
    while (esc.length < n) { var melhor = null, md = -1; for (var i = 0; i < c.length; i++) { if (esc.indexOf(c[i]) >= 0) continue; var d = 1e9; for (var k = 0; k < esc.length; k++) d = Math.min(d, dist(c[i], esc[k])); if (d > md) { md = d; melhor = c[i]; } } esc.push(melhor); }
    return esc;
  }
  var B = R.bases, M = R.monstros, I = R.itens;

  // 1) bases em sequencia a partir de onde a pessoa esta: a 1a a uns 80 m (nunca perto demais: os monstros acordam a 35 m), as outras sempre as mais proximas da anterior
  var rota = [];
  for (var raio = B.raioMaxDaLargadaM; raio <= 420; raio += 40) {
    var cand = A.pontos.filter(function (p) { var d = dist(p, L); return d >= B.distMinDaLargadaM && d <= raio; });
    if (!cand.length) continue;
    cand.sort(function (a, b) { return Math.abs(dist(a, L) - B.alvoDaPrimeiraM) - Math.abs(dist(b, L) - B.alvoDaPrimeiraM); });
    rota = [cand[0]]; var atual = cand[0];
    while (rota.length < B.quantidade) {
      var livres = cand.filter(function (p) { return rota.every(function (r) { return dist(p, r) >= B.distMinEntreBasesM; }); });
      if (!livres.length) break;
      livres.sort(function (a, b) { return dist(a, atual) - dist(b, atual); });
      rota.push(livres[0]); atual = livres[0];
    }
    if (rota.length >= B.quantidade) break;
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

  // 3) itens: so os que ficam perto do percurso, bem espalhados
  function perto(lista, max) { return lista.filter(function (p) { return distRota(p, linha) <= max; }); }
  var curas = espalhar(perto(A.curas, I.distMaxDaRotaM), I.curas);
  var pedras = espalhar(perto(A.pedras, I.distMaxDaRotaM), I.pedras);
  var bombas = espalhar(perto(A.bombas, I.distMaxBombasM || I.distMaxDaRotaM), I.bombas);
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

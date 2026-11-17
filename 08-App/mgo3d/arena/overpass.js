// Consulta a Overpass com varios servidores e espera crescente (o publico vive lotado).
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
async function consultar(q, tentativas = 8) {
  let espera = 4000;
  for (let t = 0; t < tentativas; t++) {
    const url = SERVIDORES[t % SERVIDORES.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'MGO-gerador/1.0 (projeto educacional)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(90000) });
      const txt = await r.text();
      if (r.ok && txt.trim().startsWith('{')) return JSON.parse(txt);
      console.error('  [overpass] ' + url + ' -> ' + r.status + ' (tentativa ' + (t + 1) + ')');
    } catch (e) { console.error('  [overpass] ' + url + ' -> ' + e.message + ' (tentativa ' + (t + 1) + ')'); }
    await new Promise((ok) => setTimeout(ok, espera)); espera = Math.min(espera * 1.6, 25000);
  }
  throw new Error('Overpass indisponivel apos ' + tentativas + ' tentativas');
}
module.exports = { consultar };

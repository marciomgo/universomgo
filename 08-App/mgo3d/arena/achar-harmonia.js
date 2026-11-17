const { consultar } = require('./overpass');
(async () => {
  const q = '[out:json][timeout:40];(way["leisure"~"park|garden"](-30.062,-51.262,-30.030,-51.225);relation["leisure"~"park|garden"](-30.062,-51.262,-30.030,-51.225););out tags center;';
  const r = await consultar(q, 6);
  r.elements.forEach((e) => console.log(e.type, e.id, e.tags.name || '(sem nome)', JSON.stringify(e.center || ''), 'leisure=' + (e.tags.leisure || '')));
})().catch((e) => { console.error(e.message); process.exit(1); });

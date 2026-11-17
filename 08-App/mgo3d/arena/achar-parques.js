const fs = require('fs'); const { consultar } = require('./overpass');
(async () => {
  const q = '[out:json][timeout:60];area["name"="Porto Alegre"]["boundary"="administrative"]->.a;(nwr(area.a)["leisure"="park"]["name"~"Marinha do Brasil|Harmonia|Germânia|Farroupilha|Moinhos de Vento|Redenção"];);out tags center;';
  const r = await consultar(q);
  fs.writeFileSync(__dirname + '/achados.json', JSON.stringify(r, null, 1));
  r.elements.forEach((e) => console.log(e.type, e.id, e.tags.name, JSON.stringify(e.center || ''), e.tags.leisure, e.tags.access || ''));
})().catch((e) => { console.error(e.message); process.exit(1); });

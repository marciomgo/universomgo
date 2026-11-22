// utilitario: baixa e costura tiles do satelite Esri (World Imagery) de um retangulo; devolve imagem RGBA + conversao lat/lng <-> pixel
const jpeg = require('jpeg-js'); const fs = require('fs'); const path = require('path'); const os = require('os');
const CACHE = path.join(os.tmpdir(), 'mgo-sat'); fs.mkdirSync(CACHE, { recursive: true });
const tileDe = (lat, lng, Z) => { const N = 2 ** Z; return [Math.floor((lng + 180) / 360 * N), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * N)]; };
const px = (lat, lng, Z) => { const N = 2 ** Z; return [(lng + 180) / 360 * N * 256, (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * N * 256]; };
const ll = (X, Y, Z) => { const N = 2 ** Z; const lng = X / 256 / N * 360 - 180; const n = Math.PI * (1 - 2 * Y / 256 / N); return [lng, 180 / Math.PI * Math.atan(Math.sinh(n))]; };
async function tile(x, y, Z, fonte) {
  const f = path.join(CACHE, `${fonte}-${Z}-${x}-${y}.jpg`); let buf;
  if (fs.existsSync(f)) buf = fs.readFileSync(f);
  else {
    const url = fonte === 'clarity' ? `https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}` : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'MGO-teste/1.0' } }); buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f, buf);
  }
  return jpeg.decode(buf, { useTArray: true });
}
// bbox = [W,S,E,N]
async function carregar(bbox, Z = 19, fonte = 'esri') {
  const [x0, y1] = tileDe(bbox[1], bbox[0], Z), [x1, y0] = tileDe(bbox[3], bbox[2], Z);
  const w = (x1 - x0 + 1) * 256, h = (y1 - y0 + 1) * 256; const data = new Uint8Array(w * h * 4);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const im = await tile(x, y, Z, fonte);
    for (let r = 0; r < 256; r++) for (let c = 0; c < 256; c++) { const a = (r * 256 + c) * 4, b = (((y - y0) * 256 + r) * w + (x - x0) * 256 + c) * 4; data[b] = im.data[a]; data[b + 1] = im.data[a + 1]; data[b + 2] = im.data[a + 2]; data[b + 3] = 255; }
  }
  const ox = x0 * 256, oy = y0 * 256;
  return { w, h, data, Z, aPix: (lat, lng) => { const p = px(lat, lng, Z); return [p[0] - ox, p[1] - oy]; }, aGeo: (X, Y) => ll(X + ox, Y + oy, Z) };
}
module.exports = { carregar, jpeg };

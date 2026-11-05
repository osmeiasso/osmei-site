import fs from 'fs';
import { feature, neighbors } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'));
const geoms = topo.objects.countries.geometries;
const monde = feature(topo, topo.objects.countries).features;

const SIX = {
  'Cameroon': 'Cameroun', 'Central African Rep.': 'République centrafricaine', 'Congo': 'République du Congo',
  'Dem. Rep. Congo': 'République démocratique du Congo', 'Gabon': 'Gabon', 'Eq. Guinea': 'Guinée équatoriale',
};
const FR = {
  'Nigeria': 'Nigeria', 'Chad': 'Tchad', 'S. Sudan': 'Soudan du Sud', 'Sudan': 'Soudan', 'Angola': 'Angola',
  'Zambia': 'Zambie', 'Uganda': 'Ouganda', 'Tanzania': 'Tanzanie', 'Rwanda': 'Rwanda', 'Burundi': 'Burundi',
};
// Voisins calculés à partir des frontières terrestres communes (topologie Natural Earth)
const nb = neighbors(geoms);
const idxSix = Object.keys(SIX).map(n => geoms.findIndex(g => g.properties.name === n));
const voisinsNoms = new Set();
idxSix.forEach(i => nb[i].forEach(j => voisinsNoms.add(geoms[j].properties.name)));
Object.keys(SIX).forEach(n => voisinsNoms.delete(n));
for (const n of voisinsNoms) if (!FR[n]) throw new Error('Nom français manquant : ' + n);

const six = monde.filter(f => SIX[f.properties.name]);
const voisins = monde.filter(f => voisinsNoms.has(f.properties.name));

const W = 1200, H = 1060, M = 40, BANDE = 20, BLEU = '#1F5FA8';
const haut = M + BANDE + 140, bas = H - M - BANDE - 120;
// Cadrage sur les six pays avec une marge, les voisins sont coupés au bord du cadre
const proj = geoMercator().fitExtent([[M + 170, haut + 40], [W - M - 170, bas - 40]], { type: 'FeatureCollection', features: six });
proj.clipExtent([[M, haut], [W - M, bas]]);
const path = geoPath(proj);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Jost, Verdana, sans-serif">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
// Pays frontaliers : contour bleu
for (const f of voisins) svg += `<path d="${path(f)}" fill="none" stroke="${BLEU}" stroke-width="1.6" stroke-linejoin="round"/>`;
// Six pays : contour noir
for (const f of six) svg += `<path d="${path(f)}" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>`;

const txt = (x, y, lignes, coul, taille, ancre = 'middle') => lignes.map((l, i) =>
  `<text x="${x}" y="${y + i * (taille + 4)}" text-anchor="${ancre}" font-size="${taille}" font-weight="500" fill="${coul}" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`).join('');

// Étiquettes des pays frontaliers, au centre de leur partie visible
const decalV = { 'Tanzanie': [-20, 0], 'Burundi': [-34, 6], 'Rwanda': [-30, -4], 'Ouganda': [0, 10], 'Nigeria': [0, 10], 'Angola': [-40, 0], 'Zambie': [45, 35], 'Soudan': [0, 0] };
for (const f of voisins) {
  const nom = FR[f.properties.name];
  const c = path.centroid(f); if (!isFinite(c[0])) continue;
  if (nom === 'Rwanda' || nom === 'Burundi') {
    // Petits pays : nom à l'est, relié par un trait fin
    const lx = c[0] + 75, ly = c[1] + (nom === 'Rwanda' ? -28 : 22);
    svg += `<line x1="${c[0]}" y1="${c[1]}" x2="${lx - 4}" y2="${ly - 5}" stroke="${BLEU}" stroke-width="1"/>`;
    svg += `<circle cx="${c[0]}" cy="${c[1]}" r="2.5" fill="${BLEU}"/>`;
    svg += txt(lx, ly, [nom], BLEU, 15, 'start');
    continue;
  }
  const [dx, dy] = decalV[nom] || [0, 0];
  svg += txt(c[0] + dx, c[1] + dy, [nom], BLEU, 17);
}
// Étiquettes des six pays
const decal = { 'Cameroun': [0, 40], 'République du Congo': [20, 30], 'République démocratique du Congo': [-10, 10], 'Gabon': [-5, 10] };
for (const f of six) {
  const nom = SIX[f.properties.name];
  if (nom === 'Guinée équatoriale') {
    const polys = f.geometry.coordinates;
    const aire = p => { const b = path.bounds({ type: 'Polygon', coordinates: p }); return (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]); };
    const grand = polys.reduce((m, p) => aire(p) > aire(m) ? p : m);
    const b = path.bounds({ type: 'Polygon', coordinates: grand });
    svg += txt(b[0][0] - 10, (b[0][1] + b[1][1]) / 2 - 6, ['Guinée', 'équatoriale'], '#000000', 16, 'end');
    continue;
  }
  const [x, y] = proj(geoCentroid(f));
  const [dx, dy] = decal[nom] || [0, 0];
  const lignes = nom === 'République démocratique du Congo' ? ['République démocratique', 'du Congo']
               : nom === 'République centrafricaine' ? ['République', 'centrafricaine']
               : nom === 'République du Congo' ? ['République', 'du Congo'] : [nom];
  svg += txt(x + dx, y + dy, lignes, '#000000', 17);
}
// Titre
svg += `<text x="${W / 2}" y="${M + BANDE + 66}" text-anchor="middle" font-size="50" font-weight="500" fill="#000000">Le Bassin du Congo</text>`;
svg += `<text x="${W / 2}" y="${M + BANDE + 106}" text-anchor="middle" font-size="26" fill="#000000">Les six pays du massif forestier et leurs voisins</text>`;
// Légende
const ly = bas + 36;
svg += `<line x1="${M + 20}" y1="${ly}" x2="${M + 60}" y2="${ly}" stroke="#000000" stroke-width="3"/>`;
svg += `<text x="${M + 72}" y="${ly + 6}" font-size="16" fill="#000000">Les six pays du massif forestier du Bassin du Congo</text>`;
svg += `<line x1="${M + 20}" y1="${ly + 30}" x2="${M + 60}" y2="${ly + 30}" stroke="${BLEU}" stroke-width="3"/>`;
svg += `<text x="${M + 72}" y="${ly + 36}" font-size="16" fill="${BLEU}">Les pays frontaliers (frontière terrestre commune)</text>`;
// Source
svg += `<text x="${W - M}" y="${H - M - BANDE - 30}" text-anchor="end" font-size="12" fill="#5A6670">Source : Natural Earth, frontières administratives au 1:50 000 000 (naturalearthdata.com), domaine public.</text>`;
svg += `<text x="${W - M}" y="${H - M - BANDE - 12}" text-anchor="end" font-size="12" fill="#5A6670">Données mises en forme par world-atlas 2.0 (M. Bostock, licence ISC). Projection de Mercator.</text>`;
// Bandes ODD
const ODD = ['#E5243B','#DDA63A','#4C9F38','#C5192D','#FF3A21','#26BDE2','#FCC30B','#A21942','#FD6925','#DD1367','#FD9D24','#BF8B2E','#3F7E44','#0A97D9','#56C02B','#00689D','#19486A'];
const larg = (W - 2 * M) / 17;
ODD.forEach((c, i) => {
  svg += `<rect x="${M + i * larg}" y="${M}" width="${larg + 0.5}" height="${BANDE}" fill="${c}"/>`;
  svg += `<rect x="${M + i * larg}" y="${H - M - BANDE}" width="${larg + 0.5}" height="${BANDE}" fill="${c}"/>`;
});
svg += `</svg>`;
fs.writeFileSync('carte-frontaliers.svg', svg);
console.log('ok', [...voisinsNoms].map(n => FR[n]).join(', '));

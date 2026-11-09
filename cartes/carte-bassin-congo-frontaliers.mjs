import fs from 'fs';
import { feature, neighbors, merge } from 'topojson-client';
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

const HERO = process.env.HERO === '1';
const W = HERO ? 900 : 1200, H = HERO ? 1040 : 1180, M = HERO ? 0 : 40, BANDE = HERO ? 0 : 20, BLEU = '#8A949C', VERT_BC = '#3F7E44';
const haut = M + BANDE + 140, bas = H - M - BANDE - (HERO ? 180 : 240);
// Cadrage sur les six pays avec une marge, les voisins sont coupés au bord du cadre
const proj = geoMercator().fitExtent([[M + (HERO ? 120 : 170), haut + 30], [W - M - (HERO ? 120 : 170), bas - 30]], { type: 'FeatureCollection', features: six });
proj.clipExtent([[M, haut], [W - M, bas]]);
const path = geoPath(proj);

let svg = HERO ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte du Bassin du Congo : les six pays du massif forestier et leurs voisins" font-family="Jost, Verdana, sans-serif">`
  : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Jost, Verdana, sans-serif">\n<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
// Pays frontaliers : contour bleu
for (const f of voisins) svg += `<path d="${path(f)}" fill="none" stroke="${BLEU}" stroke-width="1.6" stroke-linejoin="round"/>`;
// Six pays : contour noir
for (const f of six) svg += `<path d="${path(f)}" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>`;
// Contour extérieur de l'ensemble des six pays, accentué
const ensemble = merge(topo, geoms.filter(g => SIX[g.properties.name]));
svg += `<path d="${path(ensemble)}" fill="none" stroke="${VERT_BC}" stroke-width="5" stroke-linejoin="round"/>`;

const txt = (x, y, lignes, coul, taille, ancre = 'middle') => lignes.map((l, i) =>
  `<text class="lbl" x="${x}" y="${y + i * (taille + 4)}" text-anchor="${ancre}" font-size="${taille}" font-weight="500" fill="${coul}" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`).join('');

// Étiquettes des pays frontaliers, au centre de leur partie visible
const decalV = { 'Tanzanie': [-20, 0], 'Burundi': [-34, 6], 'Rwanda': [-30, -4], 'Ouganda': [0, 10], 'Nigeria': [0, 10], 'Angola': [-40, 0], 'Zambie': [80, 5], 'Soudan': [0, 0] };
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
const decal = { 'Cameroun': [0, 8], 'République du Congo': [12, 0], 'République démocratique du Congo': [-10, 10], 'Gabon': [-5, 10] };
for (const f of six) {
  const nom = SIX[f.properties.name];
  if (nom === 'Guinée équatoriale') {
    const polys = f.geometry.coordinates;
    const aire = p => { const b = path.bounds({ type: 'Polygon', coordinates: p }); return (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]); };
    const grand = polys.reduce((m, p) => aire(p) > aire(m) ? p : m);
    const b = path.bounds({ type: 'Polygon', coordinates: grand });
    const my = (b[0][1] + b[1][1]) / 2;
    // Flèche rouge vers la partie continentale
    svg += `<defs><marker id="pointe" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#E5243B"/></marker></defs>`;
    svg += `<line x1="${b[0][0] - 44}" y1="${my}" x2="${b[0][0] - 3}" y2="${my}" stroke="#E5243B" stroke-width="3" marker-end="url(#pointe)"/>`;
    svg += txt(b[0][0] - 50, my - 6, ['Guinée', 'équatoriale'], '#000000', 16, 'end');
    // Île de Bioko : nom et flèche rouge depuis l'étiquette du pays
    const bioko = polys.find(p => geoCentroid({ type: 'Polygon', coordinates: p })[1] > 3);
    if (bioko) {
      const bb = path.bounds({ type: 'Polygon', coordinates: bioko });
      const bx = (bb[0][0] + bb[1][0]) / 2, byc = (bb[0][1] + bb[1][1]) / 2;
      svg += `<line x1="${b[0][0] - 56}" y1="${my - 26}" x2="${bx - 2}" y2="${bb[1][1] + 4}" stroke="#E5243B" stroke-width="3" marker-end="url(#pointe)"/>`;
      svg += `<text x="${bb[0][0] - 8}" y="${byc + 2}" text-anchor="end" font-size="15" font-style="italic" fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">Bioko</text>`;
    }
    continue;
  }
  const [x, y] = proj(geoCentroid(f));
  const [dx, dy] = decal[nom] || [0, 0];
  const lignes = nom === 'République démocratique du Congo' ? ['République démocratique', 'du Congo']
               : nom === 'République centrafricaine' ? ['République', 'centrafricaine']
               : nom === 'République du Congo' ? ['République', 'du Congo'] : [nom];
  if (nom === 'République du Congo') {
    // Pays étroit et allongé : nom écrit le long de son axe, pour ne pas déborder
    const cx = x + dx, cy = y + dy;
    svg += `<text x="${cx}" y="${cy}" transform="rotate(-62 ${cx} ${cy})" text-anchor="middle" font-size="15" font-weight="500" fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">République du Congo</text>`;
    continue;
  }
  svg += txt(x + dx, y + dy, lignes, '#000000', 17);
}
// Capitales des six pays : point orange (coordonnées en degrés, longitude puis latitude)
const VERT = '#FD6925';
const CAPITALES = [
  { pays: 'Cameroun', ville: 'Yaoundé', lonlat: [11.502, 3.848], d: [0, 0] },
  { pays: 'République centrafricaine', ville: 'Bangui', lonlat: [18.558, 4.394], d: [0, 0] },
  { pays: 'République du Congo', ville: 'Brazzaville', lonlat: [15.283, -4.267], d: [-5, -4] },
  { pays: 'République démocratique du Congo', ville: 'Kinshasa', lonlat: [15.322, -4.325], d: [5, 4] },
  { pays: 'Gabon', ville: 'Libreville', lonlat: [9.454, 0.390], d: [0, 0] },
  { pays: 'Guinée équatoriale', ville: 'Ciudad de la Paz', lonlat: [10.818, 1.588], d: [0, 0] },
];
for (const c of CAPITALES) {
  const [x, y] = proj(c.lonlat);
  svg += `<circle cx="${x + c.d[0]}" cy="${y + c.d[1]}" r="6.5" fill="${VERT}" stroke="#FFFFFF" stroke-width="1.5"/>`;
}
// Océan Atlantique
{
  const [ox, oy] = proj([6.2, -3.2]);
  ['Océan', 'Atlantique'].forEach((l, i) => {
    svg += `<text x="${ox}" y="${oy + i * 30}" text-anchor="middle" font-size="27" font-weight="500" font-style="italic" fill="#0047AB" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`;
  });
}
// Titre
svg += `<text x="${W / 2}" y="${M + BANDE + 66}" text-anchor="middle" font-size="50" font-weight="500" fill="#000000">Le Bassin du Congo</text>`;
svg += `<text x="${W / 2}" y="${M + BANDE + 106}" text-anchor="middle" font-size="26" fill="#000000">Les six pays du massif forestier et leurs voisins</text>`;
// Légende
const ly = bas + 36;
const FL = HERO ? 12.5 : 16, FC = HERO ? 11.5 : 15, PAS = HERO ? 22 : 30;
svg += `<line x1="${M + 20}" y1="${ly}" x2="${M + 60}" y2="${ly}" stroke="${VERT_BC}" stroke-width="5"/>`;
svg += `<text x="${M + 72}" y="${ly + 5}" font-size="${FL}" fill="#000000">Les six pays du massif forestier du Bassin du Congo</text>`;
svg += `<line x1="${M + 20}" y1="${ly + PAS}" x2="${M + 60}" y2="${ly + PAS}" stroke="${BLEU}" stroke-width="3"/>`;
svg += `<text x="${M + 72}" y="${ly + PAS + 5}" font-size="${FL}" fill="#000000">Les pays frontaliers (frontière terrestre commune)</text>`;
// Légende des capitales, hors de la carte
{
  const cy0 = ly + (HERO ? 56 : 74);
  svg += `<circle cx="${M + 40}" cy="${cy0 - 5}" r="6.5" fill="${VERT}" stroke="#FFFFFF" stroke-width="1.5"/>`;
  svg += `<text x="${M + 72}" y="${cy0}" font-size="${FL}" font-weight="500" fill="#000000">Capitales</text>`;
  const colW = (W - 2 * M - 72) / 2;
  CAPITALES.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    svg += `<text x="${M + 72 + col * colW}" y="${cy0 + (HERO ? 20 : 26) + row * (HERO ? 18 : 24)}" font-size="${FC}" fill="#000000">${c.pays}, capitale ${c.ville}</text>`;
  });
}
// Source
if (!HERO) {
svg += `<text x="${W - M}" y="${H - M - BANDE - 30}" text-anchor="end" font-size="12" fill="#5A6670">Source : Natural Earth, frontières administratives au 1:50 000 000 (naturalearthdata.com), domaine public.</text>`;
svg += `<text x="${W - M}" y="${H - M - BANDE - 12}" text-anchor="end" font-size="12" fill="#5A6670">Données mises en forme par world-atlas 2.0 (M. Bostock, licence ISC). Projection de Mercator.</text>`;
}
// Bandes ODD
if (!HERO) {
const ODD = ['#E5243B','#DDA63A','#4C9F38','#C5192D','#FF3A21','#26BDE2','#FCC30B','#A21942','#FD6925','#DD1367','#FD9D24','#BF8B2E','#3F7E44','#0A97D9','#56C02B','#00689D','#19486A'];
const larg = (W - 2 * M) / 17;
ODD.forEach((c, i) => {
  svg += `<rect x="${M + i * larg}" y="${M}" width="${larg + 0.5}" height="${BANDE}" fill="${c}"/>`;
  svg += `<rect x="${M + i * larg}" y="${H - M - BANDE}" width="${larg + 0.5}" height="${BANDE}" fill="${c}"/>`;
});
}
svg += `</svg>`;
fs.writeFileSync(HERO ? 'carte-frontaliers-accueil.svg' : 'carte-frontaliers.svg', svg);
console.log('ok', [...voisinsNoms].map(n => FR[n]).join(', '));

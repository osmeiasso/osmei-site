import fs from 'fs';
import { feature, neighbors, merge } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

const THEME = process.env.THEME; // 'foret' ou 'fleuve'
const bassin = JSON.parse(fs.readFileSync('bassin_congo_grdc.geojson', 'utf8'));
const fleuve = JSON.parse(fs.readFileSync('fleuve_congo_ne.geojson', 'utf8'));
const foret = JSON.parse(fs.readFileSync('massif_forestier_wwf.geojson', 'utf8'));
const montagne = JSON.parse(fs.readFileSync('forets_montagne_wwf.geojson', 'utf8'));
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
const DOC = process.env.DOC === '1';
const W = HERO ? 900 : 1200, H = HERO ? 1080 : (DOC ? 1080 : 1260), M = HERO ? 0 : 40, BANDE = HERO ? 0 : 20, BLEU = '#8A949C';
const haut = M + BANDE + (DOC ? 10 : 140), bas = H - M - BANDE - (HERO ? 220 : (DOC ? 280 : 320));
// Cadrage sur les six pays avec une marge, les voisins sont coupés au bord du cadre
const proj = geoMercator().fitExtent([[M + (HERO ? 120 : 170), haut + 30], [W - M - (HERO ? 120 : 170), bas - 30]], { type: 'FeatureCollection', features: THEME === 'fleuve' ? [...six, bassin] : six });
proj.clipExtent([[M, haut], [W - M, bas]]);
const path = geoPath(proj);

let svg = HERO ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte du Bassin du Congo : les six pays du massif forestier et leurs voisins" font-family="Jost, Verdana, sans-serif">`
  : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Jost, Verdana, sans-serif">\n<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
// Pays frontaliers : contour bleu
for (const f of voisins) svg += `<path d="${path(f)}" fill="none" stroke="${BLEU}" stroke-width="1.6" stroke-linejoin="round"/>`;
// Six pays : contour noir
for (const f of six) svg += `<path d="${path(f)}" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>`;
const VFORET = '#3F7E44', VIOLET = '#6A3D9A', EAU = '#0A6FB8';
svg += `<defs><pattern id="pointsVerts" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="2" fill="${VFORET}"/></pattern></defs>`;
if (THEME === 'foret') {
  svg += `<path d="${path(foret)}" fill="${VFORET}" fill-opacity="0.16" stroke="${VFORET}" stroke-width="3" stroke-dasharray="10 6" stroke-linejoin="round"/>`;
  svg += `<path d="${path(montagne)}" fill="url(#pointsVerts)" stroke="none"/>`;
  for (const f of six) svg += `<path d="${path(f)}" fill="none" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>`;
}
// Contour extérieur de l'ensemble des six pays, accentué
const ensemble = merge(topo, geoms.filter(g => SIX[g.properties.name]));
svg += `<path d="${path(ensemble)}" fill="none" stroke="#000000" stroke-width="5" stroke-linejoin="round"/>`;

if (THEME === 'fleuve') {
  svg += `<path d="${path(bassin)}" fill="none" stroke="${VIOLET}" stroke-width="3.5" stroke-linejoin="round"/>`;
  svg += `<path d="${path(fleuve)}" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  svg += `<path d="${path(fleuve)}" fill="none" stroke="${EAU}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
}
const txt = (x, y, lignes, coul, taille, ancre = 'middle') => lignes.map((l, i) =>
  `<text class="lbl" x="${x}" y="${y + i * (taille + 4)}" text-anchor="${ancre}" font-size="${taille}" font-weight="500" fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`).join('');

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
    svg += txt(lx, ly, [nom], '#000000', 15, 'start');
    continue;
  }
  const [dx, dy] = decalV[nom] || [0, 0];
  svg += txt(c[0] + dx, c[1] + dy, [nom], '#000000', 17);
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
// Toponymie du thème
const top = (lonlat, lignes, coul, taille, dx = 0, dy = 0, ancre = 'middle', ital = true) => { const [x, y] = proj(lonlat);
  return lignes.map((l, i) => `<text x="${x + dx}" y="${y + dy + i * (taille + 3)}" text-anchor="${ancre}" font-size="${taille}" font-weight="600" ${ital ? 'font-style="italic"' : ''} fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`).join(''); };
if (THEME === 'foret') {
  svg += top([29.3, -0.5], ['Forêts de montagne', 'du rift albertin'], VFORET, 14, 150, -2, 'start');
  svg += top([10.6, 6.3], ['Forêts de montagne', 'du Cameroun'], VFORET, 14, -20, -30, 'end');
  svg += top([20.5, 1.6], ['Massif forestier'], VFORET, 18);
}
if (THEME === 'fleuve') {
  const src = proj([26.249278, -11.742852]), emb = proj([13.184337, -5.856296]);
  svg += `<circle cx="${src[0]}" cy="${src[1]}" r="6" fill="${EAU}" stroke="#fff" stroke-width="2"/><circle cx="${emb[0]}" cy="${emb[1]}" r="6" fill="${EAU}" stroke="#fff" stroke-width="2"/>`;
  svg += top([26.249278, -11.742852], ['Source', '(Lualaba)'], EAU, 14, 14, 22, 'start');
  svg += top([13.184337, -5.856296], ['Embouchure'], EAU, 14, -10, 22, 'end');
  svg += top([21.0, 1.9], ['Fleuve Congo'], EAU, 17, 0, -12);
  svg += top([26.3, -7.4], ['Lualaba'], EAU, 14, -10, 0, 'end');
  svg += top([18.6, -9.2], ['Bassin du fleuve Congo'], VIOLET, 16, 0, 0);
}
// Océan Atlantique
{
  const [ox, oy] = proj([6.2, -3.2]);
  ['Océan', 'Atlantique'].forEach((l, i) => {
    svg += `<text x="${ox}" y="${oy + i * 30}" text-anchor="middle" font-size="27" font-weight="500" font-style="italic" fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`;
  });
}
// Titre
if (!DOC) {
svg += `<text x="${W / 2}" y="${M + BANDE + 66}" text-anchor="middle" font-size="50" font-weight="500" fill="#000000">Le Bassin du Congo</text>`;
svg += `<text x="${W / 2}" y="${M + BANDE + 106}" text-anchor="middle" font-size="26" fill="#000000">${THEME === 'foret' ? 'Le massif forestier et les forêts de montagne' : 'Le bassin du fleuve Congo et le fleuve'}</text>`;
}
// Légende
const ly = bas + 36, P = 30;
const L = [
  [`<line x1="${M + 20}" y1="Y" x2="${M + 60}" y2="Y" stroke="#000000" stroke-width="5"/>`, 'Les six pays du Bassin du Congo'],
  [`<line x1="${M + 20}" y1="Y" x2="${M + 60}" y2="Y" stroke="${BLEU}" stroke-width="3"/>`, 'Les pays frontaliers (frontière terrestre commune)'],
  ...(THEME === 'foret' ? [
  [`<rect x="${M + 20}" y="Y0" width="40" height="18" fill="${VFORET}" fill-opacity="0.16"/><line x1="${M + 20}" y1="Y" x2="${M + 60}" y2="Y" stroke="${VFORET}" stroke-width="3" stroke-dasharray="10 6"/>`, 'Massif forestier du Bassin du Congo (forêts denses humides de basse altitude)'],
  [`<rect x="${M + 20}" y="Y0" width="40" height="18" fill="url(#pointsVerts)"/>`, 'Forêts de montagne (rift albertin ; Cameroun : hauts plateaux, mont Cameroun et Bioko)']] : [
  [`<line x1="${M + 20}" y1="Y" x2="${M + 60}" y2="Y" stroke="${VIOLET}" stroke-width="3.5"/>`, 'Bassin du fleuve Congo (territoire dont les eaux s\'écoulent vers le fleuve)'],
  [`<line x1="${M + 20}" y1="Y" x2="${M + 60}" y2="Y" stroke="${EAU}" stroke-width="4"/><circle cx="${M + 60}" cy="Y" r="5" fill="${EAU}"/>`, 'Fleuve Congo, de sa source (Lualaba) à l\'océan Atlantique']]),
];
const wrap = (t, n) => { const w = t.split(' '), out = ['']; w.forEach(m => { const c = out[out.length - 1]; if (c && !/^[:;!?»]$/.test(m) && (c + ' ' + m).length > n) out.push(m); else out[out.length - 1] = c ? c + ' ' + m : m; }); return out; };
{ let y = ly; const LH = 22;
  L.forEach(([sym, t]) => { const lignes = wrap(t, 44);
    svg += sym.replace(/Y0/g, y - 9).replace(/"Y"/g, `"${y}"`);
    lignes.forEach((l, k) => { svg += `<text x="${M + 72}" y="${y + 6 + k * LH}" font-size="18" fill="#000000">${l}</text>`; });
    y += lignes.length * LH + 12; });
}
// Légende des capitales, bloc de droite
{
  const x0 = M + (W - 2 * M) / 2 + 20, cy0 = ly + 6;
  svg += `<circle cx="${x0 + 10}" cy="${cy0 - 6}" r="7" fill="${VERT}" stroke="#FFFFFF" stroke-width="1.5"/>`;
  svg += `<text x="${x0 + 30}" y="${cy0}" font-size="18" font-weight="500" fill="#000000">Capitales</text>`;
  CAPITALES.forEach((c, i) => {
    svg += `<text x="${x0 + 30}" y="${cy0 + 28 + i * 24}" font-size="17" fill="#000000">${c.pays}, capitale ${c.ville}</text>`;
  });
}
// Source
if (DOC) {
  const x0 = M + (W - 2 * M) / 2 + 50;
  const src = (THEME === 'foret' ? 'Forêts : WWF, Terrestrial Ecoregions of the World (Olson et al., 2001). ' : 'Bassin du fleuve : GRDC (2020), Major River Basins of the World, BfG, Coblence. Fleuve : Natural Earth 1:10 000 000. ') + 'Frontières : Natural Earth 1:50 000 000, domaine public ; world-atlas 2.0 (M. Bostock, licence ISC).';
  wrap(src, 80).forEach((l, k) => { svg += `<text x="${x0}" y="${ly + 186 + k * 16}" font-size="12" fill="#000000">${l}</text>`; });
}
if (!HERO && !DOC) {
svg += `<text x="${W - M}" y="${H - M - BANDE - 30}" text-anchor="end" font-size="12" fill="#000000">Source : Natural Earth, frontières administratives au 1:50 000 000 (naturalearthdata.com), domaine public.</text>`;
svg += `<text x="${W - M}" y="${H - M - BANDE - 12}" text-anchor="end" font-size="12" fill="#000000">Données mises en forme par world-atlas 2.0 (M. Bostock, licence ISC).</text>`;
svg += `<text x="${W - M}" y="${H - M - BANDE - 48}" text-anchor="end" font-size="12" fill="#000000">${THEME === 'foret' ? 'Forêts : WWF, Terrestrial Ecoregions of the World (Olson et al., 2001).' : 'Bassin du fleuve : GRDC (2020), Major River Basins of the World, BfG, Coblence. Fleuve : Natural Earth 1:10 000 000.'}</text>`;
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
fs.writeFileSync('/home/claude/essai/carte-bassin-congo-' + THEME + (DOC ? '-doc' : '') + '.svg', svg);
console.log('ok', [...voisinsNoms].map(n => FR[n]).join(', '));

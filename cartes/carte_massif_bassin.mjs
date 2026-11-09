import fs from 'fs';
import { feature, merge } from 'topojson-client';
import { geoMercator, geoPath, geoBounds } from 'd3-geo';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'));
const geoms = topo.objects.countries.geometries;
const monde = feature(topo, topo.objects.countries).features;
const bassin = JSON.parse(fs.readFileSync('bassin_congo_grdc.geojson', 'utf8'));
const fleuve = JSON.parse(fs.readFileSync('fleuve_congo_ne.geojson', 'utf8'));
const ORANGE = '#0A6FB8';

const SIX = { 'Cameroon': 'Cameroun', 'Central African Rep.': 'République centrafricaine', 'Congo': 'République du Congo',
  'Dem. Rep. Congo': 'République démocratique du Congo', 'Gabon': 'Gabon', 'Eq. Guinea': 'Guinée équatoriale' };
const FR = { 'Nigeria': 'Nigeria', 'Chad': 'Tchad', 'S. Sudan': 'Soudan du Sud', 'Sudan': 'Soudan', 'Angola': 'Angola',
  'Zambia': 'Zambie', 'Uganda': 'Ouganda', 'Tanzania': 'Tanzanie', 'Rwanda': 'Rwanda', 'Burundi': 'Burundi', 'Malawi': 'Malawi',
  'Kenya': 'Kenya', 'Ethiopia': 'Éthiopie', 'Namibia': 'Namibie', 'Botswana': 'Botswana', 'Mozambique': 'Mozambique',
  'Zimbabwe': 'Zimbabwe', 'Niger': 'Niger', 'Benin': 'Bénin', 'Somalia': 'Somalie', 'Libya':'Libye','Togo':'Togo','Ghana':'Ghana','Burkina Faso':'Burkina Faso' };

const W = 1200, H = 1480, M = 40, BANDE = 20;
const VERT = '#000000', BLEU = '#6A3D9A', GRIS = '#9AA3AA', EAU = '#0A6FB8';
const haut = M + BANDE + 150, bas = H - M - BANDE - 290;
const six = monde.filter(f => SIX[f.properties.name]);
const proj = geoMercator().fitExtent([[M + 60, haut + 25], [W - M - 60, bas - 35]],
  { type: 'FeatureCollection', features: [...six, bassin] });
proj.clipExtent([[M, haut], [W - M, bas]]);
const path = geoPath(proj);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Jost, Verdana, sans-serif">\n<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
const ODD = ['#E5243B','#DDA63A','#4C9F38','#C5192D','#FF3A21','#26BDE2','#FCC30B','#A21942','#FD6925','#DD1367','#FD9D24','#BF8B2E','#3F7E44','#0A97D9','#56C02B','#00689D','#19486A'];
const lw = (W - 2 * M) / 17;
ODD.forEach((c, i) => { svg += `<rect x="${M + i * lw}" y="${M}" width="${lw + 0.5}" height="${BANDE}" fill="${c}"/><rect x="${M + i * lw}" y="${H - M - BANDE}" width="${lw + 0.5}" height="${BANDE}" fill="${c}"/>`; });
svg += `<text x="${W / 2}" y="${M + BANDE + 70}" text-anchor="middle" font-size="44" font-weight="500" fill="#000">Le Bassin du Congo</text>`;
svg += `<text x="${W / 2}" y="${M + BANDE + 115}" text-anchor="middle" font-size="26" fill="#000">Le massif forestier et le bassin du fleuve Congo</text>`;

// Tous les pays visibles : contour gris fin
const visibles = monde.filter(f => { const b = path.bounds(f); return isFinite(b[0][0]) && b[1][0] - b[0][0] > 0; });
for (const f of visibles) if (!SIX[f.properties.name]) svg += `<path d="${path(f)}" fill="none" stroke="${GRIS}" stroke-width="1.2" stroke-linejoin="round"/>`;
// Bassin du fleuve : surface bleu très clair
svg += `<path d="${path(bassin)}" fill="${BLEU}" fill-opacity="0.10" stroke="none"/>`;
// Six pays : contour noir fin
for (const f of six) svg += `<path d="${path(f)}" fill="none" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>`;
// Contour du massif forestier (six pays) en vert
const ensemble = merge(topo, geoms.filter(g => SIX[g.properties.name]));
svg += `<path d="${path(ensemble)}" fill="none" stroke="${VERT}" stroke-width="6" stroke-linejoin="round"/>`;
// Contour du bassin du fleuve en bleu
svg += `<path d="${path(bassin)}" fill="none" stroke="${BLEU}" stroke-width="4" stroke-linejoin="round" stroke-dasharray="14 7"/>`;

// Fleuve Congo (Lualaba), de sa source à l'embouchure
svg += `<path d="${path(fleuve)}" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
svg += `<path d="${path(fleuve)}" fill="none" stroke="${ORANGE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const src = proj([26.249278, -11.742852]), emb = proj([13.184337, -5.856296]);
svg += `<circle cx="${src[0]}" cy="${src[1]}" r="7" fill="${ORANGE}" stroke="#fff" stroke-width="2"/>`;
svg += `<circle cx="${emb[0]}" cy="${emb[1]}" r="7" fill="${ORANGE}" stroke="#fff" stroke-width="2"/>`;
const txt = (x, y, lignes, coul, taille, ancre = 'middle', poids = 500) => lignes.map((l, i) =>
  `<text x="${x}" y="${y + i * (taille + 3)}" text-anchor="${ancre}" font-size="${taille}" font-weight="${poids}" fill="${coul}" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`).join('');
// Étiquettes des autres pays (gris), si leur centre est dans le cadre
const dec = { 'Zambie': [-30, 25], 'Angola': [-10, 40], 'Tanzanie': [30, 30], 'Soudan du Sud': [10, 0], 'Tchad': [0, 40], 'Nigeria': [-20, 0] };
for (const f of visibles) {
  const nom = FR[f.properties.name]; if (SIX[f.properties.name] || !nom || nom === 'Rwanda' || nom === 'Burundi') continue;
  const c = path.centroid(f); if (!(c[0] > M + 40 && c[0] < W - M - 40 && c[1] > haut + 20 && c[1] < bas - 20)) continue;
  const [dx, dy] = dec[nom] || [0, 0];
  svg += txt(c[0] + dx, c[1] + dy, [nom], '#6B757C', 16, 'middle', 400);
}
// Six pays (noir)
const dec6 = { 'Cameroun': [0, 8], 'République du Congo': [8, 0], 'République démocratique du Congo': [0, 30], 'Gabon': [-4, 8], 'République centrafricaine': [0, 0] };
for (const f of six) {
  const nom = SIX[f.properties.name];
  if (nom === 'Guinée équatoriale') { const c = proj([10.4, 1.55]); svg += txt(c[0] - 26, c[1] + 4, ['Guinée', 'équatoriale'], '#000', 13, 'end'); continue; }
  const c = path.centroid(f); const [dx, dy] = dec6[nom] || [0, 0];
  if (nom === 'République du Congo') { svg += `<text x="${c[0] + dx}" y="${c[1] + dy}" text-anchor="middle" font-size="14" font-weight="500" fill="#000" stroke="#fff" stroke-width="4" paint-order="stroke" transform="rotate(-62 ${c[0] + dx} ${c[1] + dy})">République du Congo</text>`; continue; }
  const L = nom === 'République démocratique du Congo' ? ['République démocratique', 'du Congo'] : nom === 'République centrafricaine' ? ['République', 'centrafricaine'] : [nom];
  svg += txt(c[0] + dx, c[1] + dy, L, '#000', 18);
}
svg += txt(src[0] - 14, src[1] - 22, ['Source du', 'fleuve (Lualaba)'], EAU, 15, 'end', 600);
svg += txt(emb[0] - 12, emb[1] + 24, ['Embouchure'], EAU, 15, 'end', 600);
{ const fl = proj([21.0, 1.9]); svg += txt(fl[0], fl[1] - 12, ['Fleuve Congo'], EAU, 17, 'middle', 600).replace(/<text /g, '<text font-style="italic" '); }
const oc = proj([6.0, -6.5]); svg += txt(oc[0], oc[1], ['Océan', 'Atlantique'], '#0047AB', 26, 'middle', 500).replace(/<text /g, '<text font-style="italic" ');

// Légende
let ly = bas + 45;
svg += `<line x1="${M + 20}" y1="${ly}" x2="${M + 90}" y2="${ly}" stroke="${VERT}" stroke-width="6"/>`;
svg += `<text x="${M + 105}" y="${ly + 6}" font-size="20" fill="#000">Bassin du Congo : ensemble des six pays du massif forestier (contour extérieur)</text>`;
ly += 42;
svg += `<rect x="${M + 20}" y="${ly - 12}" width="70" height="24" fill="${BLEU}" fill-opacity="0.10"/><line x1="${M + 20}" y1="${ly}" x2="${M + 90}" y2="${ly}" stroke="${BLEU}" stroke-width="4" stroke-dasharray="14 7"/>`;
svg += `<text x="${M + 105}" y="${ly + 6}" font-size="20" fill="#000">Bassin du fleuve Congo : territoire dont les eaux s'écoulent vers le fleuve</text>`;
ly += 42;
svg += `<line x1="${M + 20}" y1="${ly}" x2="${M + 90}" y2="${ly}" stroke="${ORANGE}" stroke-width="4.5" stroke-linecap="round"/><circle cx="${M + 90}" cy="${ly}" r="6" fill="${ORANGE}"/>`;
svg += `<text x="${M + 105}" y="${ly + 6}" font-size="20" fill="#000">Fleuve Congo, de sa source (Lualaba) à l'océan Atlantique</text>`;
ly += 42;
svg += `<line x1="${M + 20}" y1="${ly}" x2="${M + 90}" y2="${ly}" stroke="#000" stroke-width="1.4"/><text x="${M + 105}" y="${ly + 6}" font-size="20" fill="#000">Frontières des six pays</text>`;
svg += `<line x1="${W / 2 + 60}" y1="${ly}" x2="${W / 2 + 130}" y2="${ly}" stroke="${GRIS}" stroke-width="1.2"/><text x="${W / 2 + 145}" y="${ly + 6}" font-size="20" fill="#000">Autres pays</text>`;
ly += 50;
svg += `<text x="${M + 20}" y="${ly}" font-size="13" fill="#39434B">Sources : frontières Natural Earth 1:50 000 000 et fleuve Natural Earth 1:10 000 000 (domaine public) ; world-atlas 2.0 (M. Bostock, licence ISC).</text>`;
svg += `<text x="${M + 20}" y="${ly + 20}" font-size="13" fill="#39434B">Bassin du fleuve Congo : GRDC (2020), Major River Basins of the World, Global Runoff Data Centre, Coblence, Bundesanstalt für Gewässerkunde (BfG).</text>`;
svg += '</svg>';
fs.writeFileSync('carte-massif-et-bassin-fleuve.svg', svg);
console.log('ok', svg.length);

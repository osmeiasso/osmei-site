import fs from 'fs';
import { feature } from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'));
const monde = feature(topo, topo.objects.countries).features;

// Les six pays du massif forestier, chacun cerné d'une couleur ODD
const PAYS = [
  { geo: 'Cameroon',          nom: 'Cameroun',                         odd: 13, coul: '#3F7E44' },
  { geo: 'Central African Rep.', nom: 'République centrafricaine',     odd: 4,  coul: '#C5192D' },
  { geo: 'Congo',             nom: 'République du Congo',              odd: 6,  coul: '#26BDE2' },
  { geo: 'Dem. Rep. Congo',   nom: 'République démocratique du Congo', odd: 15, coul: '#56C02B' },
  { geo: 'Gabon',             nom: 'Gabon',                            odd: 17, coul: '#19486A' },
  { geo: 'Eq. Guinea',        nom: 'Guinée équatoriale',               odd: 14, coul: '#0A97D9' },
];
const ODD = ['#E5243B','#DDA63A','#4C9F38','#C5192D','#FF3A21','#26BDE2','#FCC30B','#A21942','#FD6925','#DD1367','#FD9D24','#BF8B2E','#3F7E44','#0A97D9','#56C02B','#00689D','#19486A'];

const W = 1200, H = 1000, M = 40, BANDE = 20;
const cible = PAYS.map(p => {
  const f = monde.find(x => x.properties.name === p.geo);
  if (!f) throw new Error('Pays introuvable : ' + p.geo);
  return { ...p, f };
});
const zone = { type: 'FeatureCollection', features: cible.map(c => c.f) };
const proj = geoMercator().fitExtent([[M + 40, M + BANDE + 150], [W - M - 40, H - M - BANDE - 60]], zone);
const path = geoPath(proj);

// Position des étiquettes (ajustements manuels pour la lisibilité)
const decal = {
  'Cameroun': [0, 40], 'République centrafricaine': [0, 0], 'République du Congo': [20, 30],
  'République démocratique du Congo': [0, 0], 'Gabon': [-5, 10], 'Guinée équatoriale': [-150, -30],
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Jost, Verdana, sans-serif">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
`;
const larg = (W - 2 * M) / 17;
const Y0 = M + BANDE + 125, Y1 = H - M - BANDE - 30;
svg += `<defs><clipPath id="zone"><rect x="${M}" y="${Y0}" width="${W - 2 * M}" height="${Y1 - Y0}" rx="6"/></clipPath></defs>`;
svg += `<rect x="${M}" y="${Y0}" width="${W - 2 * M}" height="${Y1 - Y0}" fill="#FFFFFF" rx="6"/>`;
svg += `<g clip-path="url(#zone)">`;


// Six pays : fond très clair et contour épais dans la couleur ODD
for (const c of [...cible].sort((a,b)=>(a.nom==='Guinée équatoriale')-(b.nom==='Guinée équatoriale'))) {
  svg += `<path d="${path(c.f)}" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>`;
}
// Étiquettes
for (const c of cible) {
  const [x, y] = proj(geoCentroid(c.f));
  const [dx, dy] = decal[c.nom] || [0, 0];
  const lignes = c.nom === 'République démocratique du Congo' ? ['République démocratique', 'du Congo']
               : c.nom === 'République centrafricaine' ? ['République', 'centrafricaine']
               : c.nom === 'République du Congo' ? ['République', 'du Congo'] : [c.nom];
  let tx = x + dx, ty = y + dy, ancre = 'middle';
  if (c.nom === 'Guinée équatoriale') {
    // Étiquette collée à la partie continentale (Río Muni), à gauche de son contour
    const polys = c.f.geometry.type === 'MultiPolygon' ? c.f.geometry.coordinates : [c.f.geometry.coordinates];
    const aire = p => { const b = path.bounds({type:'Polygon',coordinates:p}); return (b[1][0]-b[0][0])*(b[1][1]-b[0][1]); };
    const grand = polys.reduce((m, p) => aire(p) > aire(m) ? p : m);
    const b = path.bounds({type:'Polygon',coordinates:grand});
    tx = b[0][0] - 10; ty = (b[0][1] + b[1][1]) / 2 - 4; ancre = 'end';
    lignes.splice(0, lignes.length, 'Guinée', 'équatoriale');
  }
  lignes.forEach((l, i) => {
    svg += `<text x="${tx}" y="${ty + i * 20}" text-anchor="${ancre}" font-size="17" font-weight="500" fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`;
  });
}
svg += `</g>`;
svg += `<text x="${W - M}" y="${H - M - BANDE - 30}" text-anchor="end" font-size="12" fill="#5A6670">Source : Natural Earth, frontières administratives au 1:50 000 000 (naturalearthdata.com), domaine public.</text>`;
svg += `<text x="${W - M}" y="${H - M - BANDE - 12}" text-anchor="end" font-size="12" fill="#5A6670">Données mises en forme par world-atlas 2.0 (M. Bostock, licence ISC). Projection de Mercator.</text>`;
ODD.forEach((c, i) => {
  svg += `<rect x="${M + i * larg}" y="${M}" width="${larg + 0.5}" height="${BANDE}" fill="${c}"/>`;
  svg += `<rect x="${M + i * larg}" y="${H - M - BANDE}" width="${larg + 0.5}" height="${BANDE}" fill="${c}"/>`;
});
// Titre
svg += `<text x="${W / 2}" y="${M + BANDE + 66}" text-anchor="middle" font-size="50" font-weight="500" fill="#000000">Le Bassin du Congo</text>`;
svg += `<text x="${W / 2}" y="${M + BANDE + 106}" text-anchor="middle" font-size="26" fill="#000000">Les six pays du massif forestier</text>`;
svg += `</svg>`;
fs.writeFileSync('carte-contours.svg', svg);
console.log('ok', svg.length);

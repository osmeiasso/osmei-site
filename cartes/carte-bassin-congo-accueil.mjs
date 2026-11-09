import fs from 'fs';
import { feature, merge } from 'topojson-client';
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

const W = 760, H = 900, M = 0, BANDE = 0;
const cible = PAYS.map(p => {
  const f = monde.find(x => x.properties.name === p.geo);
  if (!f) throw new Error('Pays introuvable : ' + p.geo);
  return { ...p, f };
});
const zone = { type: 'FeatureCollection', features: cible.map(c => c.f) };
const proj = geoMercator().fitExtent([[M + 120, M + BANDE + 140], [W - M - 10, H - M - BANDE - 10]], zone);
const path = geoPath(proj);

// Position des étiquettes (ajustements manuels pour la lisibilité)
const decal = {
  'Cameroun': [0, 40], 'République centrafricaine': [0, 0], 'République du Congo': [20, 30],
  'République démocratique du Congo': [28, 15], 'Gabon': [-5, 10], 'Guinée équatoriale': [-150, -30],
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte du Bassin du Congo : les six pays du massif forestier" font-family="Jost, Verdana, sans-serif">

`;
const larg = (W - 2 * M) / 17;
const Y0 = 0, Y1 = H;
svg += `<defs><clipPath id="zone"><rect x="${M}" y="${Y0}" width="${W - 2 * M}" height="${Y1 - Y0}" rx="6"/></clipPath></defs>`;
svg += `<rect x="${M}" y="${Y0}" width="${W - 2 * M}" height="${Y1 - Y0}" fill="#FFFFFF" rx="6"/>`;
svg += `<g clip-path="url(#zone)">`;


// Six pays : fond très clair et contour épais dans la couleur ODD
for (const c of [...cible].sort((a,b)=>(a.nom==='Guinée équatoriale')-(b.nom==='Guinée équatoriale'))) {
  svg += `<path d="${path(c.f)}" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>`;
}
// Contour extérieur de l'ensemble du Bassin du Congo (six pays) : noir
const NOMS6 = new Set(cible.map(c => c.f.properties.name));
svg += `<path d="${path(merge(topo, topo.objects.countries.geometries.filter(g => NOMS6.has(g.properties.name))))}" fill="none" stroke="#000000" stroke-width="5" stroke-linejoin="round"/>`;
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
    svg += `<text x="${tx}" y="${ty + i * 26}" text-anchor="${ancre}" class="lbl" font-size="18" font-weight="500" fill="#000000" stroke="#FFFFFF" stroke-width="4" paint-order="stroke">${l}</text>`;
  });
}
svg += `</g>`;

// Titre
svg += `<text x="${W / 2}" y="${M + BANDE + 66}" text-anchor="middle" font-size="48" font-weight="500" fill="#000000">Le Bassin du Congo</text>`;
svg += `<text x="${W / 2}" y="${M + BANDE + 106}" text-anchor="middle" font-size="26" fill="#000000">Les six pays du massif forestier</text>`;
svg += `</svg>`;
fs.writeFileSync('carte-hero.svg', svg);
console.log('ok', svg.length);

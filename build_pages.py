"""Génère une vraie adresse par rubrique (dossier/index.html), le sitemap, robots.txt et la page 404,
à partir de index.html. À lancer sur la branche main avant chaque mise en ligne."""
import os, re, shutil
SITE = 'https://osmei.fr'
PAGES = {
    'comprendre': 'Comprendre',
    'systeme-terre': 'Le système Terre',
    'atmosphere': 'Atmosphère : le climat',
    'hydrosphere': 'Hydrosphère : fleuves, zones humides et tourbières',
    'lithosphere': 'Lithosphère : sols et sous-sol',
    'biosphere': 'Biosphère : forêts, faune et flore',
    'societes-humaines': 'Sociétés humaines : agriculture, énergie et gouvernance',
    'guinee-equatoriale': 'Guinée équatoriale',
    'gabon': 'Gabon',
    'republique-centrafricaine': 'République centrafricaine',
    'republique-du-congo': 'République du Congo',
    'cameroun': 'Cameroun',
    'republique-democratique-du-congo': 'République Démocratique du Congo (RDC)',
    'orientation': "S'orienter",
    'ludique': 'Jouer pour apprendre',
    'qui-sommes-nous': 'Qui sommes-nous ?',
    'notre-demarche': 'Notre démarche',
    'actions': 'Agir avec OSMEI',
    'actions-ressources': 'Ressources pédagogiques',
    'demande-ressources': 'Demande de séquences pédagogiques',
    'formations': 'Nos formations',
    'contact': 'Contact',
    'don': 'Faire un don',
    'mentions-legales': 'Mentions légales',
    'recherche': 'Rechercher',
}
SANS_INDEX = {'recherche'}
# Anciennes adresses : la page charge le site, qui renvoie vers la nouvelle adresse.
ANCIENNES = {'actualite-odd': 'systeme-terre', 'climat-biodiversite': 'systeme-terre', 'metiers-education': 'orientation', 'climat': 'atmosphere', 'faune-et-flore': 'biosphere', 'forets': 'biosphere', 'fleuves-zones-humides-tourbieres': 'hydrosphere', 'sols': 'lithosphere', 'energie': 'societes-humaines'}
src = open('index.html', encoding='utf8').read()
def page(html, titre, url, index=True):
    html = re.sub(r'<title>.*?</title>', '<title>%s</title>' % titre, html, count=1)
    html = re.sub(r'\n<link rel="canonical"[^>]*>', '', html)
    extra = '\n<link rel="canonical" href="%s">' % url
    if not index:
        extra += '\n<meta name="robots" content="noindex">'
    if url != SITE + '/':
        html = re.sub(r'\n<meta name="description"[^>]*>', '', html)
    return html.replace('</title>', '</title>' + extra, 1)
import json, unicodedata, html as H
def slugify(t):
    t = t.replace('œ', 'oe').replace('Œ', 'oe').replace('æ', 'ae')
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:80].rstrip('-')
_i = src.index('var POSTS = ') + len('var POSTS = '); _j = src.index(';\n', _i)
POSTS = json.loads(src[_i:_j])
ARTICLES = {}
for p in POSTS:
    a = p.get('article') or {}
    if a.get('statut') == 'Validé' and a.get('titre'):
        sl = slugify(a['titre']); base = sl; n = 2
        while sl in ARTICLES.values(): sl = '%s-%d' % (base, n); n += 1
        ARTICLES[str(p['id'])] = sl
src = re.sub(r'var ART_SLUGS=\{.*?\};', lambda m: 'var ART_SLUGS=' + json.dumps(ARTICLES, ensure_ascii=False) + ';', src, count=1)
IMG_DEF = SITE + '/logo-osmei-400.png'
def partage(html, titre, desc, url, img, typ='website'):
    html = re.sub(r'\n<meta property="og:[^>]*>|\n<meta name="twitter:[^>]*>', '', html)
    e = lambda x: H.escape(x, quote=True)
    tags = ('\n<meta property="og:type" content="%s">\n<meta property="og:site_name" content="OSMEI">'
            '\n<meta property="og:title" content="%s">\n<meta property="og:description" content="%s">'
            '\n<meta property="og:url" content="%s">\n<meta property="og:image" content="%s">'
            '\n<meta name="twitter:card" content="summary_large_image">') % (typ, e(titre), e(desc), url, img)
    return html.replace('</title>', '</title>' + tags, 1)
DESC0 = re.search(r'<meta name="description" content="([^"]*)"', src).group(1)
open('index.html', 'w', encoding='utf8').write(partage(page(src, re.search(r'<title>(.*?)</title>', src).group(1), SITE + '/'), re.search(r'<title>(.*?)</title>', src).group(1), DESC0, SITE + '/', IMG_DEF))
for slug, t in PAGES.items():
    os.makedirs(slug, exist_ok=True)
    open(os.path.join(slug, 'index.html'), 'w', encoding='utf8').write(
        partage(page(src, t.replace('&', '&amp;') + ' | OSMEI', '%s/%s/' % (SITE, slug), slug not in SANS_INDEX), t + ' | OSMEI', DESC0, '%s/%s/' % (SITE, slug), IMG_DEF))
for pid, sl in ARTICLES.items():
    p = [x for x in POSTS if str(x['id']) == pid][0]; a = p['article']
    figs = a.get('figures') or []
    img = SITE + '/' + figs[0]['img'].lstrip('/') if figs and figs[0].get('img') else IMG_DEF
    if a.get('partage_img'): img = SITE + '/' + a['partage_img'].lstrip('/')
    desc = re.sub(r'\s+', ' ', a.get('chapeau', '')).strip()
    desc = desc if len(desc) <= 200 else desc[:197].rsplit(' ', 1)[0] + '…'
    url = '%s/articles/%s/' % (SITE, sl)
    os.makedirs(os.path.join('articles', sl), exist_ok=True)
    h = page(src, H.escape(a['titre']) + ' | OSMEI', url)
    h = h.replace('</title>', '</title>\n<meta name="description" content="%s">' % H.escape(desc, quote=True), 1)
    open(os.path.join('articles', sl, 'index.html'), 'w', encoding='utf8').write(partage(h, a['titre'], desc, url, img, 'article'))
for old, new in ANCIENNES.items():
    os.makedirs(old, exist_ok=True)
    open(os.path.join(old, 'index.html'), 'w', encoding='utf8').write(
        page(src, PAGES[new].replace('&', '&amp;') + ' | OSMEI', '%s/%s/' % (SITE, new), False))
open('404.html', 'w', encoding='utf8').write(page(src, re.search(r'<title>(.*?)</title>', src).group(1), SITE + '/', False))
urls = [SITE + '/'] + ['%s/%s/' % (SITE, s) for s in PAGES if s not in SANS_INDEX] + ['%s/articles/%s/' % (SITE, sl) for sl in ARTICLES.values()]
open('sitemap.xml', 'w', encoding='utf8').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ''.join('  <url><loc>%s</loc></url>\n' % u for u in urls) + '</urlset>\n')
open('robots.txt', 'w', encoding='utf8').write('User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n' % SITE)
print('pages :', len(PAGES), '| articles :', len(ARTICLES), '| sitemap :', len(urls), 'adresses')

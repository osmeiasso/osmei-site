"""Génère une vraie adresse par rubrique (dossier/index.html), le sitemap, robots.txt et la page 404,
à partir de index.html. À lancer sur la branche main avant chaque mise en ligne."""
import os, re, shutil
SITE = 'https://osmei.fr'
PAGES = {
    'actualite-odd': 'Actualité & ODD',
    'metiers-education': 'Métiers et éducation orientés développement durable',
    'ludique': 'Ludique',
    'qui-sommes-nous': 'Qui sommes-nous ?',
    'actions': 'Nos actions',
    'actions-ressources': 'Ressources pédagogiques',
    'formations': 'Nos formations',
    'agenda': 'Agenda',
    'contact': 'Contact',
    'don': 'Faire un don',
    'mentions-legales': 'Mentions légales',
    'recherche': 'Rechercher',
}
SANS_INDEX = {'recherche'}
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
open('index.html', 'w', encoding='utf8').write(page(src, re.search(r'<title>(.*?)</title>', src).group(1), SITE + '/'))
for slug, t in PAGES.items():
    os.makedirs(slug, exist_ok=True)
    open(os.path.join(slug, 'index.html'), 'w', encoding='utf8').write(
        page(src, t.replace('&', '&amp;') + ' | OSMEI', '%s/%s/' % (SITE, slug), slug not in SANS_INDEX))
open('404.html', 'w', encoding='utf8').write(page(src, re.search(r'<title>(.*?)</title>', src).group(1), SITE + '/', False))
urls = [SITE + '/'] + ['%s/%s/' % (SITE, s) for s in PAGES if s not in SANS_INDEX]
open('sitemap.xml', 'w', encoding='utf8').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ''.join('  <url><loc>%s</loc></url>\n' % u for u in urls) + '</urlset>\n')
open('robots.txt', 'w', encoding='utf8').write('User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n' % SITE)
print('pages :', len(PAGES), '| sitemap :', len(urls), 'adresses')

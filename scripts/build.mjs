// Zusammenbau von lernfunkenwelt.de: liest die Seitenquellen aus src/pages,
// ergänzt Kopf, Navigation, Brotkrumen, strukturierte Daten, Werbeplätze und Fuß
// und schreibt statisches HTML nach docs/. Nur für diese Website geschrieben.
//   node scripts/build.mjs                 → docs/
//   node scripts/build.mjs --preview-ads --out=.preview  → Vorschau mit Platzhaltern

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PREVIEW = !!args['preview-ads'];
const OUT = join(ROOT, args.out || 'docs');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config/site.json'), 'utf8'));
const ORIGIN = cfg.origin;
const PUB = cfg.adsense.client;
const SLOTS = { ...cfg.adsense.slots };
if (PREVIEW) for (const k of Object.keys(SLOTS)) SLOTS[k] = SLOTS[k] || 'VORSCHAU';

if (PREVIEW && OUT !== join(ROOT, 'docs')) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const d of ['assets', 'data']) cpSync(join(ROOT, 'docs', d), join(OUT, d), { recursive: true });
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&shy;/g, '').replace(/\s+/g, ' ').trim();

// ---------- Navigation ----------
const NAV = [
  ['/foerder-check/', 'Förder-Check'], ['/lernplan/', 'Lernplan'], ['/karteikarten/', 'Karteikarten'],
  ['/lerntechniken/', 'Lerntechniken'], ['/rechtschreibung/', 'Rechtschreibung'], ['/methodik-und-quellen/', 'Methodik']
];
const MENU = [
  ['/foerder-check/', 'Förder-Check'], ['/lernplan/', 'Lernplan-Generator'], ['/karteikarten/', 'Karteikarten'], ['/rechtschreibung/', 'Rechtschreibtraining'],
  ['/weiterbildungszeit/', 'Weiterbildungszeit (AT)'], ['/fachkraeftestipendium/', 'Fachkräftestipendium (AT)'], ['/foerderung-wien-oberoesterreich/', 'Wien & Oberösterreich'],
  ['/bildungsurlaub/', 'Bildungsurlaub (DE)'], ['/aufstiegs-bafoeg-rechner/', 'Aufstiegs-BAföG-Rechner'], ['/foerderung-beschaeftigte-deutschland/', 'Förderung im Job (DE)'],
  ['/lerntechniken/', 'Lerntechniken'], ['/verteiltes-lernen/', 'Verteiltes Lernen'], ['/abrufen-statt-wiederlesen/', 'Abrufen statt Wiederlesen'], ['/lernen-neben-dem-job/', 'Lernen neben dem Job'],
  ['/berufsreifepruefung/', 'Berufsreifeprüfung'], ['/meister-fachwirt-vorbereitung/', 'Meister & Fachwirt'], ['/sprachzertifikat-vorbereitung/', 'Sprachzertifikat B1/B2'],
  ['/methodik-und-quellen/', 'Methodik & Quellen'], ['/ueber-uns/', 'Über uns']
];
const FOOT = [
  ['Förderung', [['/foerder-check/', 'Förder-Check AT & DE'], ['/weiterbildungszeit/', 'Weiterbildungszeit'], ['/fachkraeftestipendium/', 'Fachkräftestipendium'], ['/foerderung-wien-oberoesterreich/', 'Wien & Oberösterreich'], ['/bildungsurlaub/', 'Bildungsurlaub'], ['/aufstiegs-bafoeg-rechner/', 'Aufstiegs-BAföG'], ['/foerderung-beschaeftigte-deutschland/', '§ 82 SGB III & Bildungsgutschein']]],
  ['Lernen', [['/lernplan/', 'Lernplan-Generator'], ['/karteikarten/', 'Karteikarten'], ['/rechtschreibung/', 'Rechtschreibtraining'], ['/lerntechniken/', 'Lerntechniken'], ['/verteiltes-lernen/', 'Verteiltes Lernen'], ['/abrufen-statt-wiederlesen/', 'Abrufen statt Wiederlesen'], ['/lernen-neben-dem-job/', 'Lernen neben dem Job']]],
  ['Prüfungen', [['/berufsreifepruefung/', 'Berufsreifeprüfung'], ['/meister-fachwirt-vorbereitung/', 'Meister & Fachwirt'], ['/sprachzertifikat-vorbereitung/', 'Sprachzertifikat B1/B2']]],
  ['Lernfunkenwelt', [['/ueber-uns/', 'Über uns'], ['/methodik-und-quellen/', 'Methodik & Quellen'], ['/kontakt/', 'Kontakt'], ['/impressum/', 'Impressum'], ['/datenschutz/', 'Datenschutz']]]
];

const LOGO = `<svg viewBox="0 0 64 40" aria-hidden="true" focusable="false"><g fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"><path d="M6 32 Q9 22 12 32"/><path d="M12 32 Q17 16 22 32"/><path d="M22 32 Q31 8 40 32"/><path d="M40 32 Q49 2 58 32" stroke-dasharray="1 4.2"/></g><line x1="3" y1="34.5" x2="61" y2="34.5" stroke="var(--muted)" stroke-width="1.4"/><circle cx="6" cy="32" r="4" fill="var(--spark)"/><rect x="55" y="27" width="6" height="7" rx="1" fill="var(--ink)"/></svg>`;

function header(path) {
  const nav = NAV.map(([h, t]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const menu = MENU.map(([h, t]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  return `<a class="skip" href="#inhalt">Zum Inhalt springen</a>
<header class="site-head"><div class="site-head__in">
<a class="brand" href="/">${LOGO}<span>Lernfunkenwelt<span class="brand__claim">Weiterbildung mit Plan</span></span></a>
<nav class="nav" aria-label="Hauptnavigation">${nav}</nav>
<details class="menu"><summary>Menü</summary><nav class="menu__list" aria-label="Alle Seiten">${menu}</nav></details>
</div></header>`;
}

function footer() {
  const cols = FOOT.map(([t, l]) => `<div><h2>${t}</h2><ul>${l.map(([h, x]) => `<li><a href="${h}">${x}</a></li>`).join('')}</ul></div>`).join('');
  return `<footer class="site-foot"><div class="site-foot__in">${cols}</div>
<div class="site-foot__base"><p>Lernfunkenwelt ist eine unabhängige Übersicht von AdStern, Wien – kein Angebot einer Behörde, des AMS, der Bundesagentur für Arbeit oder des waff. Inhalte für Erwachsene. Förderangaben sind Orientierung, verbindlich entscheidet die Förderstelle.</p>
<p><button type="button" class="linkbtn" data-privacy-settings>Datenschutz-Einstellungen</button> <span id="privacy-hint" role="status" hidden></span> · <a href="/impressum/">Impressum</a> · <a href="/datenschutz/">Datenschutz</a></p></div></footer>`;
}

// ---------- Werbeplätze ----------
function adBox(kind, slot, sizeCls, w, h, fmt) {
  if (!slot) return '';
  const inner = PREVIEW
    ? `<div class="ad__box preview" style="width:${w ? w + 'px' : '100%'};max-width:100%">Anzeigenplatz ${w ? w + '×' + h : 'responsiv'}</div>`
    : `<div class="ad__box"><ins class="adsbygoogle" style="display:${w ? 'inline-block' : 'block'};${w ? `width:${w}px;height:${h}px` : ''}" data-ad-client="${PUB}" data-ad-slot="${esc(slot)}"${fmt ? ` data-ad-format="${fmt}" data-full-width-responsive="true"` : ''}></ins></div>`;
  return `<aside class="ad ad--${kind} ${sizeCls}" aria-label="Anzeige"><span class="ad__label">Anzeige</span>${inner}</aside>`;
}
const adTop = () => (SLOTS.leaderboard ? adBox('top', SLOTS.leaderboard, 'ad--desk', 728, 90) : '') + (SLOTS.mobileBanner ? adBox('top', SLOTS.mobileBanner, 'ad--mob', 320, 100) : '');
const adIn = () => adBox('incontent', SLOTS.incontent, '', 0, 250, 'auto');
const adSide = () => adBox('side', SLOTS.sidebar, '', 300, 600);

// ---------- Seiten ----------
// Rechtsseiten (Impressum, Datenschutz, Kontakt) laden adsbygoogle.js nicht; die Google-CMP
// wird dort erst beim Klick auf „Datenschutz-Einstellungen“ nachgeladen (assets/js/einwilligung.js).
const SRC = join(ROOT, 'src/pages');
const files = readdirSync(SRC).filter(f => f.endsWith('.html')).sort();
const pages = [];
for (const f of files) {
  const raw = readFileSync(join(SRC, f), 'utf8');
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error('Meta fehlt in ' + f);
  const meta = JSON.parse(m[1]);
  pages.push({ ...meta, body: raw.slice(m[0].length).trim(), file: f });
}

const ORG = { '@type': 'Organization', name: 'AdStern', url: ORIGIN + '/', address: { '@type': 'PostalAddress', streetAddress: 'Seilerstätte 8', postalCode: '1010', addressLocality: 'Wien', addressCountry: 'AT' } };

function jsonld(p, url, faqs) {
  const out = [];
  if (p.path === '/') out.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lernfunkenwelt', alternateName: 'Lernfunkenwelt – Weiterbildung mit Plan', url: ORIGIN + '/', inLanguage: 'de', publisher: ORG });
  if (p.crumbs) {
    const items = [{ name: 'Startseite', item: ORIGIN + '/' }, ...p.crumbs.map(([n, h]) => ({ name: n, item: ORIGIN + h }))];
    out.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.item })) });
  }
  if (p.type === 'article') out.push({ '@context': 'https://schema.org', '@type': 'Article', headline: p.h1, description: p.description, inLanguage: 'de', datePublished: p.published || '2026-10-31', dateModified: p.modified || '2026-10-31', mainEntityOfPage: url, author: ORG, publisher: ORG });
  if (p.type === 'tool') out.push({ '@context': 'https://schema.org', '@type': 'WebApplication', name: p.appName || p.h1, url, applicationCategory: 'EducationalApplication', operatingSystem: 'Browser', inLanguage: 'de', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, publisher: ORG });
  if (faqs.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  return out.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
}

function extractFaqs(body) {
  const res = [];
  const re = /<details class="faq"[^>]*>\s*<summary>\s*<h3>([\s\S]*?)<\/h3>\s*<\/summary>\s*<div>([\s\S]*?)<\/div>\s*<\/details>/g;
  let m; while ((m = re.exec(body))) res.push([strip(m[1]), strip(m[2])]);
  return res;
}

function crumbsHtml(p) {
  if (!p.crumbs) return '';
  const all = [['Startseite', '/'], ...p.crumbs];
  return `<nav class="crumbs" aria-label="Brotkrumen"><ol>${all.map(([n, h], i) => i === all.length - 1 ? `<li><span aria-current="page">${esc(n)}</span></li>` : `<li><a href="${h}">${esc(n)}</a></li>`).join('')}</ol></nav>`;
}

const sitemap = [];
for (const p of pages) {
  const url = ORIGIN + p.path;
  const ads = p.ads !== false && !p.redirect && !p.removed;
  let body = p.body;
  // Werbe-Markierungen im Text: <!--ANZEIGE-->
  body = body.replace(/<!--ANZEIGE-->/g, ads ? adIn() : '');
  // Produkt-Platz (deaktiviert bis zur Freigabe)
  body = body.replace(/<!--PRODUKT:([a-z-]+)-->/g, (_, id) => cfg.produkt_pdf_lernplaner.aktiv ? `<section class="product card" data-product="${id}"></section>` : `<!-- Produkt-Platz „${id}“: deaktiviert, Freigabe durch den Inhaber ausstehend -->`);
  const faqs = extractFaqs(body);
  const robots = p.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">';
  const canonical = p.redirect ? ORIGIN + p.redirect : url;
  const refresh = p.redirect ? `<meta http-equiv="refresh" content="0; url=${p.redirect}">` : '';
  const scripts = (p.scripts || []).map(s => `<script type="module" src="${s}"></script>`).join('\n');
  const side = p.sidebar && ads ? `<aside class="sidebar" aria-label="Seitenleiste"><div class="card"><h2 style="font-size:1.1rem;margin-top:0">Werkzeuge</h2><ul style="padding-left:1.1rem;margin:0"><li><a href="/foerder-check/">Förder-Check</a></li><li><a href="/lernplan/">Lernplan mit .ics</a></li><li><a href="/karteikarten/">Karteikarten</a></li></ul></div>${adSide()}</aside>` : '';
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
${p.nocanonical ? '' : `<link rel="canonical" href="${canonical}">`}
${robots}
${refresh}
<meta name="google-adsense-account" content="${PUB}">
<meta name="theme-color" content="#F5F3F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17121E" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${p.type === 'article' ? 'article' : 'website'}">
<meta property="og:locale" content="de_AT">
<meta property="og:site_name" content="Lernfunkenwelt">
<meta property="og:title" content="${esc(p.h1)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${canonical}">
<link rel="icon" href="/assets/img/logo.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/literata-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});</script>
${p.removed || p.redirect || p.out === '404.html' || p.type === 'legal' ? '' : `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB}" crossorigin="anonymous"></script>\n`}<script defer src="/assets/js/einwilligung.js?v=20261102a"></script>
${jsonld(p, url, faqs)}
</head>
<body class="page-${p.type || 'page'}">
${header(p.path)}
${ads && p.path !== '/' ? `<div class="wrap">${adTop()}</div>` : ''}
<main id="inhalt" class="wrap">
${crumbsHtml(p)}
<div class="layout${side ? ' layout--side' : ''}">
<div class="content">
${body}
</div>
${side}
</div>
</main>
${footer()}
${scripts}
</body>
</html>
`;
  const target = p.out ? join(OUT, p.out) : join(OUT, p.path, 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  if (!p.noindex && !p.redirect && !p.removed && !p.nositemap) sitemap.push({ loc: url, lastmod: p.modified || '2026-10-31', prio: p.path === '/' ? '1.0' : p.type === 'tool' ? '0.9' : p.type === 'legal' ? '0.2' : '0.7' });
}

{
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(s => `  <url><loc>${s.loc}</loc><lastmod>${s.lastmod}</lastmod><priority>${s.prio}</priority></url>`).join('\n')}\n</urlset>\n`);
  writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  writeFileSync(join(OUT, 'ads.txt'), 'google.com, pub-7811071715414905, DIRECT, f08c47fec0942fa0\n');
  writeFileSync(join(OUT, 'CNAME'), 'lernfunkenwelt.de\n');
  writeFileSync(join(OUT, '.nojekyll'), '');
}
console.log(`${pages.length} Seiten gebaut nach ${OUT}${PREVIEW ? ' (Anzeigen-Vorschau)' : ''}; Sitemap: ${sitemap.length} URLs`);

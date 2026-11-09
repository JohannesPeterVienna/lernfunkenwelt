// Seitenprüfung für docs/: Wortzahl, Meta, Canonical, H1, interne Links,
// Werbeplätze, Pflichtangaben. Exit-Code 1 bei Fehlern.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, process.argv[2] || 'docs');
const ORIGIN = 'https://lernfunkenwelt.de';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'assets' && f !== 'data') walk(p); } else if (f.endsWith('.html')) files.push(p); } })(DOCS);

const NO_ADS = ['/impressum/', '/datenschutz/', '/kontakt/', '/404.html'];
const TOOLS = ['/foerder-check/', '/lernplan/', '/karteikarten/', '/rechtschreibung/', '/aufstiegs-bafoeg-rechner/'];
const strip = s => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<(form|select)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const fehler = [], zeilen = [];
const descs = new Map(), titles = new Map();

for (const f of files) {
  const rel = '/' + f.slice(DOCS.length + 1).replace(/\\/g, '/');
  const path = rel.endsWith('/index.html') ? rel.slice(0, -10) : rel;
  const h = readFileSync(f, 'utf8');
  const err = m => fehler.push(`${path}: ${m}`);
  const isRedirect = /http-equiv="refresh"/.test(h);
  const noindex = /name="robots" content="noindex/.test(h);
  if (!/<html lang="de">/.test(h)) err('lang="de" fehlt');
  if (!/<meta name="google-adsense-account" content="ca-pub-7811071715414905">/.test(h)) err('AdSense-Meta fehlt');
  const ohneWerbung = isRedirect || noindex;
  const rechtsseite = NO_ADS.includes(path);
  if (ohneWerbung && /adsbygoogle\.js/.test(h)) err('AdSense-Loader auf Weiterleitungs-/noindex-Seite');
  if (rechtsseite && /adsbygoogle\.js/.test(h)) err('AdSense-Loader auf Rechtsseite (wird erst beim Klick auf Datenschutz-Einstellungen nachgeladen)');
  if (!/gtag\('consent','default',\{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500\}\)/.test(h)) err('Consent-Default fehlt');
  else if (/adsbygoogle\.js/.test(h) && h.indexOf("gtag('consent','default'") > h.indexOf('adsbygoogle.js')) err('Consent-Default nach AdSense-Loader');
  if (!ohneWerbung && !rechtsseite && (!/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7811071715414905" crossorigin="anonymous"><\/script>/.test(h) || !/<script async src="https:\/\/pagead2/.test(h))) err('adsbygoogle.js async fehlt');
  if (/googletagmanager\.com\/gtag\/js/.test(h)) err('GA4 wird ohne Einwilligung geladen');
  if (!/data-privacy-settings/.test(h)) err('Link Datenschutz-Einstellungen fehlt');
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) err(`${h1} H1-Überschriften`);
  const title = (h.match(/<title>([^<]+)<\/title>/) || [])[1];
  const desc = (h.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  if (!title) err('Title fehlt');
  if (!desc) err('Description fehlt');
  const canon = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (!noindex) {
    if (canon !== ORIGIN + path) err(`Canonical ${canon} ≠ ${ORIGIN + path}`);
    if (desc && (desc.length < 70 || desc.length > 170)) err(`Description-Länge ${desc.length}`);
    if (title && title.length > 95) err(`Title-Länge ${title.length}`);
    if (descs.has(desc)) err('Description doppelt mit ' + descs.get(desc)); else descs.set(desc, path);
    if (titles.has(title)) err('Title doppelt mit ' + titles.get(title)); else titles.set(title, path);
  }
  if (isRedirect) { const tgt = h.match(/url=([^"]+)"/)[1]; if (canon !== ORIGIN + tgt) err('Weiterleitung: Canonical ≠ Ziel'); }
  // Werbeplätze
  const ads = (h.match(/class="ad ad--/g) || []).length;
  if ((NO_ADS.includes(path) || noindex) && ads) err('Werbeplatz auf Seite ohne Werbung');
  if (/<ins class="adsbygoogle"(?![^>]*data-ad-slot="[^"]+")/.test(h)) err('Werbeplatz ohne Slot-ID');
  if (/<aside class="ad[^"]*"[\s\S]{0,400}?<\/aside>/.test(h) && !/<span class="ad__label">Anzeige<\/span>/.test(h)) err('Anzeige ohne Beschriftung');
  // Werbeplatz darf nicht im Werkzeugbereich liegen
  for (const m of h.matchAll(/<section class="tool"[\s\S]*?<\/section>/g)) if (/class="ad /.test(m[0])) err('Werbeplatz innerhalb eines Werkzeugs');
  // JSON-LD
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { err('JSON-LD ungültig'); } }
  if (/"FAQPage"/.test(h) && !/<details class="faq"/.test(h)) err('FAQPage ohne sichtbare FAQ');
  if (!noindex && path !== '/' && !/"BreadcrumbList"/.test(h)) err('BreadcrumbList fehlt');
  // Interne Links
  for (const m of h.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    let t = m[1]; let p = join(DOCS, t);
    if (t.endsWith('/')) p = join(p, 'index.html');
    if (!existsSync(p)) err('toter interner Link ' + t);
  }
  // Wortzahl
  const main = (h.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  const w = strip(main).split(' ').filter(x => /[A-Za-zÄÖÜäöüß0-9]/.test(x)).length;
  const min = noindex ? 0 : NO_ADS.includes(path) || ['/ueber-uns/', '/kontakt/'].includes(path) ? 0 : TOOLS.includes(path) ? 700 : 900;
  if (w < min) err(`nur ${w} Wörter (min. ${min})`);
  zeilen.push([path, w, noindex ? 'noindex' : '', ads]);
}
// Pflichtangaben
const imp = readFileSync(join(DOCS, 'impressum/index.html'), 'utf8');
for (const s of ['Seilerstätte 8/8', '1010 Wien', 'office@adstern.com', 'ATU54682507', 'Magistratisches Bezirksamt für den 1./8. Bezirk', 'Fachgruppe Werbung und Marktkommunikation', 'Werbeagentur', 'Gewerbeordnung']) if (!imp.includes(s)) fehler.push('Impressum: fehlt ' + s);
if (/Tel\.|Telefon|\+43/.test(strip(imp))) fehler.push('Impressum: Telefonnummer gefunden');
const ds = readFileSync(join(DOCS, 'datenschutz/index.html'), 'utf8');
for (const s of ['GitHub', 'Drittanbieter, einschließlich Google, verwenden Cookies', 'adssettings.google.com', 'youronlinechoices', 'aboutads.info', 'Barichgasse 40–42', 'dsb@dsb.gv.at', 'delete-local', 'localStorage']) if (!ds.includes(s)) fehler.push('Datenschutz: fehlt ' + s);
for (const f of ['ads.txt', 'robots.txt', 'sitemap.xml', 'CNAME', '.nojekyll', '404.html']) if (!existsSync(join(DOCS, f))) fehler.push('fehlt ' + f);
if (existsSync(join(DOCS, 'ads.txt')) && readFileSync(join(DOCS, 'ads.txt'), 'utf8').trim() !== 'google.com, pub-7811071715414905, DIRECT, f08c47fec0942fa0') fehler.push('ads.txt falsch');
const sm = readFileSync(join(DOCS, 'sitemap.xml'), 'utf8');
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) { const p = m[1].replace(ORIGIN, ''); if (!existsSync(join(DOCS, p.endsWith('/') ? p + 'index.html' : p))) fehler.push('Sitemap-URL ohne Datei ' + p); }
// Kinderbezug
for (const f of files) { const t = readFileSync(f, 'utf8'); if (/data-age-check|kleine Entdecker|Für Eltern/i.test(t)) fehler.push('Kinderbezug in ' + f); }

zeilen.sort((a, b) => a[0].localeCompare(b[0]));
for (const [p, w, n, a] of zeilen) console.log(`${String(w).padStart(5)}  ${a ? 'Ad×' + a : '    '}  ${p} ${n}`);
if (fehler.length) { console.error('\nFEHLER:\n' + fehler.join('\n')); process.exit(1); }
console.log(`\nOK: ${files.length} Seiten geprüft, keine Fehler.`);

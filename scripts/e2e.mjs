// Browser-Test mit Playwright und System-Chrome: Überlauf bei 360/390/1366 px,
// Werkzeugfunktionen, Konsole, Werbeplatzabstände (Vorschau mit Platzhaltern), Screenshots.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIR = process.argv[2] || 'docs';
const SHOTS = process.argv[3] || 'screenshots';
mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const srv = createServer((q, r) => {
  let p = join(DIR, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404, { 'content-type': TYPES['.html'] }); return r.end(readFileSync(join(DIR, '404.html'))); }
  r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fehler = [];
const PAGES = ['/', '/foerder-check/', '/lernplan/', '/karteikarten/', '/rechtschreibung/', '/weiterbildungszeit/', '/bildungsurlaub/', '/aufstiegs-bafoeg-rechner/', '/foerderung-wien-oberoesterreich/', '/lerntechniken/', '/impressum/', '/datenschutz/', '/nicht-da/'];

for (const width of [360, 390, 1366]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'de-AT' });
  // externe Skripte (Google) im Test blockieren
  await ctx.route(/googlesyndication|googletagmanager|google-analytics|fundingchoices/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => fehler.push(`${width} JS-Fehler: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text()) && !page.url().includes('/nicht-da/')) fehler.push(`${width} Konsole: ${m.text()}`); });
  for (const p of PAGES) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ov > 0) fehler.push(`${width}px ${p}: horizontaler Überlauf ${ov}px`);
    // Werbeplätze: Abstand zu interaktiven Elementen ≥ 24 px
    const nah = await page.evaluate(() => {
      const out = [];
      const inter = [...document.querySelectorAll('main input, main select, main textarea, main button, main .btn, main .result:not(:empty)')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
      for (const ad of document.querySelectorAll('.ad')) {
        if (!ad.offsetParent) continue;
        const a = ad.getBoundingClientRect();
        for (const r of inter) {
          const dx = Math.max(0, r.left - a.right, a.left - r.right), dy = Math.max(0, r.top - a.bottom, a.top - r.bottom);
          if (Math.max(dx, dy) < 24) { out.push(Math.round(Math.max(dx, dy))); break; }
        }
      }
      return out;
    });
    if (nah.length) fehler.push(`${width}px ${p}: Werbeplatz näher als 24 px an Bedienelement (${nah.join(',')})`);
  }
  // Förder-Check
  await page.goto(base + '/foerder-check/');
  await page.fill('#fc-wst', '20'); await page.fill('#fc-dauer', '6'); await page.fill('#fc-kosten', '2400'); await page.fill('#fc-netto', '2300');
  await page.click('button[type=submit]');
  await page.waitForSelector('.lamp');
  const n = await page.locator('.lamp').count();
  if (n < 8) fehler.push(`${width} Förder-Check: nur ${n} Ergebnisse`);
  if (!(await page.textContent('#fc-result')).includes('verbindlich entscheidet die Förderstelle')) fehler.push('Förder-Check: Hinweis fehlt');
  await page.screenshot({ path: `${SHOTS}/foerdercheck-${width}.png`, fullPage: width !== 1366 ? false : false });
  await page.locator('#fc-result').screenshot({ path: `${SHOTS}/foerdercheck-ergebnis-${width}.png` });
  // Lernplan
  await page.goto(base + '/lernplan/?vorlage=sprache-b1');
  await page.fill('#lp-pruefung', '2027-02-15');
  await page.click('#lp-form button[type=submit]');
  await page.waitForSelector('#lp-ergebnis');
  const dl = page.waitForEvent('download');
  await page.click('text=Kalenderdatei (.ics) laden');
  const d = await dl; const ics = readFileSync(await d.path(), 'utf8');
  if (!ics.startsWith('BEGIN:VCALENDAR\r\n') || !ics.includes('DTSTAMP:')) fehler.push('Lernplan: ICS ungültig');
  await page.screenshot({ path: `${SHOTS}/lernplan-${width}.png` });
  await page.locator('#lp-result').screenshot({ path: `${SHOTS}/lernplan-ergebnis-${width}.png` });
  const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (ov2 > 0) fehler.push(`${width}px Lernplan-Ergebnis: Überlauf ${ov2}px`);
  // Karteikarten
  await page.goto(base + '/karteikarten/');
  await page.click('#k-beispiel'); await page.click('#k-start'); await page.click('#k-aufdecken'); await page.click('#k-gewusst');
  if ((await page.textContent('#k-faellig')).trim() !== '4') fehler.push('Karteikarten: Fälligkeit nach Bewertung falsch');
  // Rechtschreibung
  await page.goto(base + '/rechtschreibung/');
  await page.locator('#rs-antworten button').first().click();
  if (await page.locator('#rs-feedback').isHidden()) fehler.push('Rechtschreibung: kein Feedback');
  // Start
  await page.goto(base + '/');
  await page.screenshot({ path: `${SHOTS}/start-${width}.png` });
  await ctx.close();
}
await browser.close(); srv.close();
if (fehler.length) { console.error(fehler.join('\n')); process.exit(1); }
console.log('E2E OK (360/390/1366 px)');

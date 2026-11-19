// Browser-Test der Werbeplätze von lernfunkenwelt.de (Playwright, System-Chrome).
// Baut die Website mit echter Anzeigen-Auszeichnung und Prüf-Slot-ID nach .test-ads/ und prüft
// über alle Sitemap-URLs bei 1366×768 und 390×844:
//   – genau ein sichtbarer Platz oben, in Zielgröße, vollständig im ersten Bildschirm
//   – Überschrift (H1) und Beginn des Inhalts ohne Scrollen sichtbar; Werkzeug beginnt am Desktop im ersten Bildschirm
//   – Abstand jedes Platzes zu jedem Bedienelement ≥ 150 px, kein Platz in einem Werkzeug, nichts „sticky“
//   – Googles Muster: Beschriftung erst bei data-ad-status="filled", "unfilled" → Platz weg, kein Sprung beim Füllen
//   – offenes Menü (mobil) überdeckt keinen Platz; kein horizontaler Überlauf; keine JS-Fehler
//   – Seiten ohne Werbung bleiben ohne Werbung
// Google-Skripte sind im Test blockiert; „gefüllt“ wird über das Attribut simuliert.
//   node scripts/werbeplaetze-e2e.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, '.test-ads');
execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs'), '--test-slots', '--out=.test-ads'], { cwd: ROOT, stdio: 'pipe' });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
const srv = createServer((q, r) => {
  let p = join(DIR, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404, { 'content-type': TYPES['.html'] }); return r.end(readFileSync(join(DIR, '404.html'))); }
  r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;

const ORIGIN = 'https://lernfunkenwelt.de';
const sitemap = [...readFileSync(join(DIR, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(ORIGIN, ''));
const OHNE_WERBUNG = ['/impressum/', '/datenschutz/', '/kontakt/', '/404.html', '/about.html', '/imprint.html', '/privacy.html', '/advertise.html', '/das-dass.html'];
const WERKZEUG = ['/foerder-check/', '/lernplan/', '/karteikarten/', '/rechtschreibung/', '/aufstiegs-bafoeg-rechner/'];
const FLACH = ['/', '/ueber-uns/', ...WERKZEUG];
const MIT_WERBUNG = sitemap.filter(p => !OHNE_WERBUNG.includes(p));
if (MIT_WERBUNG.length < 15) throw new Error('Sitemap unerwartet klein');
const ABSTAND = 150;

const browser = await chromium.launch({ executablePath: existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--no-sandbox'] });
const fehler = [], tabelle = [];

for (const [width, height] of [[1366, 768], [390, 844]]) {
  const desk = width >= 1040;
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'de-AT' });
  await ctx.route(/googlesyndication|googletagmanager|google-analytics|fundingchoices|doubleclick/, r => r.abort());
  await ctx.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* nicht unterstützt */ }
  });
  const page = await ctx.newPage();
  let aktuell = '';
  page.on('pageerror', e => fehler.push(`${width}px ${aktuell}: JS-Fehler ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) fehler.push(`${width}px ${aktuell}: Konsole ${m.text()}`); });

  for (const p of [...MIT_WERBUNG, ...OHNE_WERBUNG]) {
    aktuell = p;
    const err = m => fehler.push(`${width}px ${p}: ${m}`);
    await page.goto(base + p.replace(/\/(about|imprint|privacy|advertise|das-dass)\.html$/, '/$1.html'), { waitUntil: 'load' });
    if (/\/(about|imprint|privacy|advertise|das-dass)\.html$/.test(p)) await page.waitForLoadState('networkidle'); // Weiterleitung abwarten
    await page.evaluate(() => document.fonts.ready);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ov > 0) err(`horizontaler Überlauf ${ov}px`);

    if (OHNE_WERBUNG.includes(p)) {
      const n = await page.evaluate(() => document.querySelectorAll('.ad, ins.adsbygoogle').length);
      // Weiterleitungen landen auf einer Zielseite; geprüft wird die ausgelieferte Datei selbst.
      const datei = readFileSync(join(DIR, p.endsWith('/') ? p + 'index.html' : p), 'utf8');
      if (/class="ad |<ins class="adsbygoogle"/.test(datei)) err('Werbeplatz auf Seite ohne Werbung');
      if (!/\.html$/.test(p) && n) err('Werbeplatz im DOM einer Seite ohne Werbung');
      continue;
    }

    // Zustand vor dem Füllen: Platz reserviert, Beschriftung unsichtbar, <ins> nicht versteckt
    const vor = await page.evaluate(() => [...document.querySelectorAll('.ad')].filter(a => a.offsetParent).map(a => {
      const ins = a.querySelector('ins.adsbygoogle');
      return { k: a.className, label: getComputedStyle(a.querySelector('.ad__label')).visibility, ins: !!ins && getComputedStyle(ins).display, h: a.getBoundingClientRect().height };
    }));
    for (const a of vor) {
      if (a.label !== 'hidden') err(`Beschriftung vor dem Füllen sichtbar (${a.k})`);
      if (!a.ins || a.ins === 'none') err(`<ins> vorab versteckt oder fehlt (${a.k})`);
    }
    const clsVor = await page.evaluate(() => window.__cls);

    // „gefüllt“ simulieren; responsive Plätze im Text bekommen ihre Zielhöhe
    const m = await page.evaluate(() => {
      for (const ins of document.querySelectorAll('.ad ins.adsbygoogle')) {
        if (!ins.closest('.ad').offsetParent) continue;
        ins.setAttribute('data-ad-status', 'filled');
        if (ins.dataset.adFormat === 'auto') ins.style.height = (innerWidth < 700 ? 280 : 250) + 'px';
      }
      const rect = e => { const r = e.getBoundingClientRect(); return { t: r.top + scrollY, b: r.bottom + scrollY, l: r.left, r: r.right, w: r.width, h: r.height }; };
      const sichtbar = e => e.offsetParent !== null;
      const bedien = [...document.querySelectorAll('main input, main select, main textarea, main button, main .btn, main summary')].filter(sichtbar).map(rect);
      const ads = [...document.querySelectorAll('.ad')].filter(sichtbar).map(a => {
        const r = rect(a.querySelector('ins.adsbygoogle'));
        let pos = '';
        for (let e = a; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e).position; if (s === 'fixed' || s === 'sticky') pos = s; }
        return { k: a.className.replace(/^ad /, ''), r, pos, imWerkzeug: !!a.closest('.tool, form'), label: getComputedStyle(a.querySelector('.ad__label')).visibility,
          abstand: Math.min(9999, ...bedien.map(c => Math.hypot(Math.max(0, c.l - r.r, r.l - c.r), Math.max(0, c.t - r.b, r.t - c.b)))) };
      });
      const h1 = rect(document.querySelector('h1')), lead = document.querySelector('.lead'), tool = document.querySelector('section.tool');
      return { ads, h1, lead: lead ? rect(lead).t : null, tool: tool ? rect(tool).t : null, cls: window.__cls };
    });
    if (m.cls - clsVor > 0.01) err(`Layout-Sprung beim Füllen (CLS +${(m.cls - clsVor).toFixed(3)})`);

    const oben = m.ads.filter(a => a.k.startsWith('ad--top'));
    if (oben.length !== 1) err(`${oben.length} sichtbare Plätze oben (erwartet 1)`);
    for (const a of m.ads) {
      if (a.label !== 'visible') err(`Beschriftung nach dem Füllen nicht sichtbar (${a.k})`);
      if (a.pos) err(`Platz ist ${a.pos} (${a.k})`);
      if (a.imWerkzeug) err(`Platz innerhalb eines Werkzeugs/Formulars (${a.k})`);
      if (a.abstand < ABSTAND) err(`Abstand ${Math.round(a.abstand)} px zu Bedienelement < ${ABSTAND} px (${a.k})`);
      if (a.r.l < 0 || a.r.r > width) err(`Platz ragt aus dem Bildschirm (${a.k})`);
    }
    if (oben[0]) {
      const o = oben[0], soll = desk ? (FLACH.includes(p) ? [970, 90] : [970, 250]) : [320, 100];
      if (Math.round(o.r.w) !== soll[0] || Math.round(o.r.h) !== soll[1]) err(`Platz oben ${Math.round(o.r.w)}×${Math.round(o.r.h)} statt ${soll.join('×')}`);
      if (o.r.t < 0 || o.r.b > height) err(`Platz oben nicht vollständig im ersten Bildschirm (${Math.round(o.r.t)}–${Math.round(o.r.b)})`);
      if (o.r.b > m.h1.t) err('Platz oben steht nicht vor der Überschrift');
      tabelle.push(`${String(width).padStart(4)}  ${p.padEnd(40)} oben ${soll.join('×').padEnd(8)} ${String(Math.round(o.r.t)).padStart(4)}–${String(Math.round(o.r.b)).padEnd(4)} H1 ${Math.round(m.h1.t)}–${Math.round(m.h1.b)}${m.tool != null && WERKZEUG.includes(p) ? ' Werkzeug ab ' + Math.round(m.tool) : ''}`);
    }
    if (m.h1.b > height) err(`Überschrift nicht vollständig im ersten Bildschirm (bis ${Math.round(m.h1.b)})`);
    if (m.lead != null && m.lead > height - 60) err(`Inhalt beginnt erst bei ${Math.round(m.lead)} px`);
    // Anteil der Plätze am ersten Bildschirm: Inhalt muss überwiegen
    const flaeche = m.ads.reduce((s, a) => s + Math.max(0, Math.min(a.r.b, height) - Math.max(a.r.t, 0)) * a.r.w, 0) / (width * height);
    if (flaeche > 0.3) err(`Plätze belegen ${(flaeche * 100).toFixed(0)} % des ersten Bildschirms (> 30 %)`);
    if (desk && WERKZEUG.includes(p) && (m.tool == null || m.tool > height - 100)) err(`Werkzeug beginnt nicht im ersten Bildschirm (${m.tool})`);
    const seite = m.ads.find(a => a.k === 'ad--side');
    if (seite && seite.r.t >= height) err(`Seitenplatz beginnt unter dem ersten Bildschirm (${Math.round(seite.r.t)})`);
    if (!desk && seite) err('Seitenplatz mobil sichtbar');
    // große Rechtecke mobil erst nach dem ersten Inhaltsblock
    if (!desk) for (const a of m.ads) if (a.k === 'ad--incontent' && a.r.t < height) err('großes Rechteck mobil im ersten Bildschirm');

    // Menü (mobil/Tablet): offen darf es keinen Platz überdecken
    if (!desk) {
      await page.click('.menu summary');
      const ueber = await page.evaluate(() => {
        const l = document.querySelector('.menu__list').getBoundingClientRect();
        const treffer = [...document.querySelectorAll('.ad')].filter(a => a.offsetParent).some(a => { const r = a.getBoundingClientRect(); return r.left < l.right && l.left < r.right && r.top < l.bottom && l.top < r.bottom; });
        return { treffer, ov: document.documentElement.scrollWidth - innerWidth, breit: l.width, links: l.left };
      });
      if (ueber.treffer) err('offenes Menü überdeckt einen Werbeplatz');
      if (ueber.ov > 0) err(`offenes Menü: horizontaler Überlauf ${ueber.ov}px`);
      if (ueber.links < 0 || ueber.breit < width - 40) err(`offenes Menü falsch ausgerichtet (links ${ueber.links}, Breite ${ueber.breit})`);
      await page.click('.menu summary');
    }

    // „unfilled“: Platz verschwindet vollständig
    const leer = await page.evaluate(() => {
      const res = [];
      for (const a of [...document.querySelectorAll('.ad')].filter(x => x.offsetParent)) {
        a.querySelector('ins.adsbygoogle').setAttribute('data-ad-status', 'unfilled');
        res.push(getComputedStyle(a).display);
      }
      return res;
    });
    if (leer.some(d => d !== 'none')) err('leerer Platz (unfilled) bleibt stehen');
  }
  await ctx.close();
}
await browser.close(); srv.close();
rmSync(DIR, { recursive: true, force: true });
console.log(tabelle.join('\n'));
if (fehler.length) { console.error('\nFEHLER:\n' + fehler.join('\n')); process.exit(1); }
console.log(`\nWerbeplätze OK: ${MIT_WERBUNG.length} Seiten mit, ${OHNE_WERBUNG.length} ohne Werbung, 1366×768 und 390×844.`);

// Einwilligungs-Selbsttest mit Playwright: simulierte Google-CMP (__tcfapi + googlefc)
// statt adsbygoogle.js, simuliertes gtag.js. Protokolliert alle Anfragen an
// googletagmanager.com und google-analytics.com je Schritt.
// Aufruf: node scripts/consent-e2e.mjs [docs]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIR = process.argv[2] || 'docs';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, r) => {
  let p = join(DIR, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;

// Simulierte CMP: Entscheidung liegt (wie das echte Cookie) im localStorage.
// window.__cmp(entscheidung, {analytics}) simuliert Klick im Dialog/Widerruf.
const CMP_STUB = `(() => {
  const ls = window.localStorage;
  const lies = () => { try { return JSON.parse(ls.getItem('stub-consent')); } catch (e) { return null; } };
  const listener = [];
  const tcData = (status) => {
    const c = lies();
    const ja = !!(c && c.tcf);
    return { gdprApplies: true, eventStatus: status, tcString: c ? 'stub' : '',
      purpose: { consents: { 1: ja } }, vendor: { consents: { 755: ja } } };
  };
  const cmStatus = () => {
    const c = lies();
    if (!c) return { adStoragePurposeConsentStatus: 0, adUserDataPurposeConsentStatus: 0, adPersonalizationPurposeConsentStatus: 0, analyticsStoragePurposeConsentStatus: 0 };
    const w = v => v === 'na' ? 3 : v === 'nc' ? 4 : v ? 1 : 2;
    return { adStoragePurposeConsentStatus: w(c.ads), adUserDataPurposeConsentStatus: w(c.ads), adPersonalizationPurposeConsentStatus: w(c.ads), analyticsStoragePurposeConsentStatus: w(c.analytics) };
  };
  window.__tcfapi = (cmd, v, cb) => {
    if (cmd === 'addEventListener') { listener.push(cb); cb(tcData(lies() ? 'tcloaded' : 'cmpuishown'), true); }
  };
  const fc = window.googlefc = window.googlefc || {};
  fc.ConsentModePurposeStatusEnum = { UNKNOWN: 0, GRANTED: 1, DENIED: 2, NOT_APPLICABLE: 3, NOT_CONFIGURED: 4 };
  fc.getGoogleConsentModeValues = cmStatus;
  fc.showRevocationMessage = () => { window.__revocationShown = true; };
  const q = fc.callbackQueue || [];
  const run = (o) => { for (const k of ['CONSENT_API_READY', 'CONSENT_DATA_READY', 'CONSENT_MODE_DATA_READY']) if (typeof o[k] === 'function') o[k](); };
  q.forEach(run); fc.callbackQueue = { push: run };
  window.__cmp = (c) => { ls.setItem('stub-consent', JSON.stringify(c)); listener.forEach(cb => cb(tcData('useractioncomplete'), true)); };
})();`;

// Simuliertes gtag.js: wertet dataLayer aus wie Google (Consent + ga-disable) und sendet Hits.
const GTAG_STUB = `(() => {
  const id = 'G-T00HRG2YVF'; let consent = {};
  const hit = (en) => { if (window['ga-disable-' + id] === true) return; if (consent.analytics_storage !== 'granted') return;
    fetch('https://www.google-analytics.com/g/collect?tid=' + id + '&en=' + en, { mode: 'no-cors' }).catch(() => {}); };
  const handle = (a) => { if (!a) return; if (a[0] === 'consent') Object.assign(consent, a[2]); if (a[0] === 'config') hit('page_view'); if (a[0] === 'event') hit(a[1]); };
  const dl = window.dataLayer = window.dataLayer || [];
  dl.forEach(handle); const push = dl.push.bind(dl); dl.push = (a) => { handle(a); return push(a); };
})();`;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ locale: 'de-AT' });
let log = [];
await ctx.route(/pagead2\.googlesyndication\.com/, r => r.fulfill({ contentType: 'text/javascript', body: CMP_STUB }));
await ctx.route(/googletagmanager\.com/, r => { log.push('GTM ' + r.request().url()); r.fulfill({ contentType: 'text/javascript', body: GTAG_STUB }); });
await ctx.route(/google-analytics\.com/, r => { log.push('GA ' + r.request().url()); r.fulfill({ status: 204, body: '' }); });
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(e.message));
const warte = () => page.waitForTimeout(700);
const ergebnisse = [];
function pruefe(schritt, erwartetGtm, erwartetGa) {
  const gtm = log.filter(l => l.startsWith('GTM')).length, ga = log.filter(l => l.startsWith('GA')).length;
  const ok = gtm === erwartetGtm && ga === erwartetGa;
  ergebnisse.push({ schritt, gtm, ga, ok, anfragen: [...log] });
  log = [];
}
const consentUpdates = () => page.evaluate(() => window.dataLayer.filter(e => e && e[0] === 'consent').map(e => [e[1], e[2].analytics_storage]));

// 1. Erstbesuch: keine Entscheidung
await page.goto(base + '/foerder-check/'); await warte();
const ersteBefehle = await page.evaluate(() => { const i = window.dataLayer.findIndex(e => e && e[0] === 'consent' && e[1] === 'default'); return { defaultIndex: i, default: window.dataLayer[i] && window.dataLayer[i][2] }; });
pruefe('Erstbesuch (Dialog offen, Status UNKNOWN)', 0, 0);
// 2. Ablehnen
await page.evaluate(() => window.__cmp({ tcf: false, analytics: false, ads: false })); await warte();
pruefe('Ablehnen', 0, 0);
// 3. TCF ja, aber Consent-Mode-Analytics DENIED (Codex-Fall)
await page.evaluate(() => window.__cmp({ tcf: true, analytics: false, ads: true })); await warte();
pruefe('TCF ja, analytics_storage DENIED', 0, 0);
// 3b. TCF ja, Consent Mode NOT_CONFIGURED
await page.evaluate(() => window.__cmp({ tcf: true, analytics: 'nc', ads: 'nc' })); await warte();
pruefe('TCF ja, Consent Mode NOT_CONFIGURED', 0, 0);
// 4. Zustimmen
await page.evaluate(() => window.__cmp({ tcf: true, analytics: true, ads: true })); await warte();
pruefe('Zustimmen', 1, 1);
// 5. Widerruf nach Zustimmung, danach weiteres Ereignis
await page.evaluate(() => window.__cmp({ tcf: false, analytics: false, ads: false })); await warte();
const nachWiderruf = await page.evaluate(() => ({ disable: window['ga-disable-G-T00HRG2YVF'], letztes: window.dataLayer.filter(e => e && e[0] === 'consent').pop()[2] }));
await page.evaluate(() => window.gtag('event', 'nach_widerruf')); await warte();
pruefe('Widerruf + Ereignis danach', 0, 0);
const verlauf = await consentUpdates();
// 6. Wiederbesuch mit gespeicherter Ablehnung
await page.reload(); await warte();
pruefe('Wiederbesuch (abgelehnt gespeichert)', 0, 0);
// 7. Wiederbesuch mit gespeicherter Zustimmung
await page.evaluate(() => localStorage.setItem('stub-consent', JSON.stringify({ tcf: true, analytics: true, ads: true })));
await page.reload(); await warte();
pruefe('Wiederbesuch (zugestimmt gespeichert)', 1, 1);
// 8. Datenschutz-Einstellungen öffnen Widerrufsdialog
await page.click('[data-privacy-settings]');
const widerrufDialog = await page.evaluate(() => window.__revocationShown === true);

await browser.close(); srv.close();
const alleOk = ergebnisse.every(e => e.ok) && ersteBefehle.defaultIndex === 0 && ersteBefehle.default.analytics_storage === 'denied'
  && nachWiderruf.disable === true && nachWiderruf.letztes.analytics_storage === 'denied' && widerrufDialog && !fehler.length;
console.log(JSON.stringify({ ersteBefehle, ergebnisse, nachWiderruf, verlauf, widerrufDialog, fehler }, null, 1));
console.log(alleOk ? 'EINWILLIGUNG OK' : 'EINWILLIGUNG FEHLER');
process.exit(alleOk ? 0 : 1);

// Kleine Rechner auf Ratgeberseiten: Stundencheck, Aufstiegs-BAföG-Eigenanteil,
// Bildungsurlaub-Tage, Wochenstunden neben dem Job. Liest Werte aus foerderungen.json.
import { bildungsurlaubAnspruch, tagsatzStufe } from './lib/foerdercheck.js';
import { el } from './speicher.js';

const eur = n => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
const zahl = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
let datenP = null;
const daten = () => (datenP ||= fetch('/data/foerderungen.json').then(r => r.json()));
const eintrag = async id => (await daten()).eintraege.find(e => e.id === id);

// --- Stundencheck Weiterbildungszeit ---
const sc = document.getElementById('sc-form');
if (sc) sc.addEventListener('submit', async ev => {
  ev.preventDefault();
  const voll = await eintrag('at-weiterbildungsbeihilfe'), teil = await eintrag('at-weiterbildungsteilzeitbeihilfe');
  const f = sc.elements;
  const ohne = f.ohne.checked;
  const art = f.art.value; // stunden | ects
  let wert = zahl(f.wert.value);
  const monate = zahl(f.monate.value);
  const out = document.getElementById('sc-result');
  const einheit = art === 'ects' ? 'ECTS pro Semester' : 'Wochenstunden';
  const sV = ohne ? voll.werte.wochenstunden_min_ohne_betreuung : voll.werte.wochenstunden_min;
  const sT = ohne ? teil.werte.wochenstunden_min_ohne_betreuung : teil.werte.wochenstunden_min;
  const zeilen = [];
  const okV = wert >= sV && monate >= voll.werte.dauer_monate_min;
  const okT = wert >= sT && monate >= teil.werte.dauer_monate_min;
  zeilen.push(el('p', {}, el('strong', { text: 'Weiterbildungszeit (Vollkarenz): ' }), okV ? `erfüllt – ${wert} ${einheit} ≥ ${sV} und ${monate} Monate ≥ ${voll.werte.dauer_monate_min}.` : `nicht erfüllt – nötig sind mindestens ${sV} ${einheit} und ${voll.werte.dauer_monate_min} Monate Dauer.`));
  zeilen.push(el('p', {}, el('strong', { text: 'Weiterbildungsteilzeit: ' }), okT ? `erfüllt – ${wert} ${einheit} ≥ ${sT} und ${monate} Monate ≥ ${teil.werte.dauer_monate_min}.` : `nicht erfüllt – nötig sind mindestens ${sT} ${einheit} und ${teil.werte.dauer_monate_min} Monate Dauer.`));
  const brutto = zahl(f.brutto.value);
  if (brutto > 0) {
    const s = tagsatzStufe(voll, brutto);
    if (s) zeilen.push(el('p', {}, `Bei ${eur(brutto)} brutto (Beitragsgrundlage) ergibt die AMS-Tabelle 2026 ${eur(s.gesamt)} pro Tag, also rund ${eur(s.gesamt * 30)} für 30 Tage.` + (s.dg ? ` Davon trägt der Dienstgeber ${eur(s.dg)} pro Tag.` : '') + (brutto < voll.werte.halbe_hbgl_eur ? ' Unter 3.465 € ist eine Bildungsberatung im BIZ verpflichtend.' : '')));
    else zeilen.push(el('p', { text: 'Unterhalb der Geringfügigkeitsgrenze greift die Tabelle nicht.' }));
  }
  zeilen.push(el('p', { class: 'hint', text: 'Orientierung, verbindlich entscheidet das AMS. Werte 2026, Quelle: AMS.' }));
  out.replaceChildren(...zeilen);
});

// --- Aufstiegs-BAföG Eigenanteil ---
const ab = document.getElementById('ab-form');
if (ab) ab.addEventListener('submit', async ev => {
  ev.preventDefault();
  const w = (await eintrag('de-aufstiegs-bafoeg')).werte;
  const f = ab.elements;
  const gebuehr = zahl(f.gebuehr.value), material = zahl(f.material.value);
  const gefG = Math.min(gebuehr, w.gebuehren_max_eur);
  const gefM = Math.min(material * w.meisterstueck_anteil_materialkosten, w.meisterstueck_max_eur);
  const zuschuss = (gefG + gefM) * w.zuschuss_prozent / 100;
  const darlehenG = gefG * (1 - w.zuschuss_prozent / 100);
  const darlehenM = gefM * (1 - w.zuschuss_prozent / 100);
  const erlass = f.ausgang.value === 'gruendung' ? darlehenG : f.ausgang.value === 'bestanden' ? darlehenG * w.erlass_bestanden_prozent / 100 : 0;
  const rest = darlehenG + darlehenM - erlass;
  const nicht = Math.max(0, gebuehr - gefG) + Math.max(0, material - gefM);
  const out = document.getElementById('ab-result');
  const t = el('table', {}, el('caption', { text: 'Ihre Rechnung' }), el('tbody', {},
    ...[['Förderfähige Lehrgangs- und Prüfungsgebühren', gefG], ['Förderfähiger Anteil Meisterprüfungsprojekt', gefM], ['Zuschuss (muss nicht zurückgezahlt werden)', zuschuss], ['KfW-Darlehen insgesamt', darlehenG + darlehenM], ['Erlass nach Ihrem gewählten Ausgang', -erlass], ['Verbleibendes Darlehen zum Zurückzahlen', rest], ['Nicht gefördert (über den Höchstbeträgen)', nicht], ['Eigenanteil gesamt (Darlehen + nicht gefördert)', rest + nicht]]
      .map(([k, v]) => el('tr', {}, el('th', { scope: 'row', text: k }), el('td', { class: 'num', text: eur(v) })))));
  out.replaceChildren(el('div', { class: 'table-wrap' }, t), el('p', { class: 'hint', text: 'Ohne Unterhaltsbeitrag (einkommensabhängig) und ohne Darlehenszinsen. Orientierung, verbindlich entscheidet das Amt für Ausbildungsförderung.' }));
});

// --- Bildungsurlaub-Tage ---
const bu = document.getElementById('bu-form');
if (bu) bu.addEventListener('submit', async ev => {
  ev.preventDefault();
  const e = await eintrag('de-bildungsurlaub');
  const l = e.laender[bu.elements.land.value];
  const tage = zahl(bu.elements.tage.value) || 5;
  const out = document.getElementById('bu-result');
  if (!l.gesetz) { out.replaceChildren(el('p', { text: 'Bayern hat kein Bildungsurlaubsgesetz. Ein Anspruch kann sich nur aus Tarifvertrag, Betriebsvereinbarung oder Arbeitsvertrag ergeben.' })); return; }
  const a = bildungsurlaubAnspruch(l, tage);
  out.replaceChildren(
    el('p', {}, el('strong', { text: `${l.name}: ${a.toLocaleString('de-DE')} Arbeitstage ${l.jahre === 2 ? 'in zwei Jahren' : 'pro Kalenderjahr'}` }), ` bei ${tage} Arbeitstagen pro Woche (${l.gesetz}).`),
    el('p', { text: `Antrag beim Arbeitgeber spätestens ${l.frist_wochen} Wochen vor Beginn.` + (l.wartezeit_monate ? ` Anspruch erst nach ${l.wartezeit_mehr_als ? 'mehr als ' : ''}${l.wartezeit_monate} Monaten Beschäftigung.` : '') + (l.gueltig_ab ? ` Gilt ab ${l.gueltig_ab.split('-').reverse().join('.')}.` : '') }),
    l.kleinbetrieb ? el('p', { text: l.kleinbetrieb }) : '',
    el('p', { class: 'hint', text: 'Bei unregelmäßigen Arbeitstagen rechnen manche Länder mit dem Jahresdurchschnitt. Orientierung, verbindlich ist das Landesgesetz.' })
  );
});

// --- Wochenstunden neben dem Job ---
const wj = document.getElementById('wj-form');
if (wj) wj.addEventListener('submit', ev => {
  ev.preventDefault();
  const f = wj.elements;
  const ziel = zahl(f.stunden.value), wochen = zahl(f.wochen.value), puffer = zahl(f.puffer.value);
  const out = document.getElementById('wj-result');
  if (!ziel || !wochen) { out.replaceChildren(el('p', { class: 'error', text: 'Bitte Stunden und Wochen eintragen.' })); return; }
  const netto = wochen * (1 - Math.min(50, puffer) / 100);
  const proWoche = ziel / netto;
  const abende = Math.ceil(proWoche * 60 / 75);
  out.replaceChildren(
    el('p', {}, el('strong', { text: `${proWoche.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Stunden pro Woche` }), ` – bei ${wochen} Wochen und ${puffer} % Puffer (= ${netto.toLocaleString('de-DE', { maximumFractionDigits: 1 })} wirksame Wochen).`),
    el('p', { text: `Das entspricht etwa ${abende} Lerneinheiten à 75 Minuten pro Woche.` + (proWoche > 12 ? ' Mehr als 12 Stunden pro Woche neben einer Vollzeitstelle halten nur wenige über Monate durch; prüfen Sie einen späteren Prüfungstermin oder eine Teilzeitlösung.' : '') }),
    el('p', {}, el('a', { href: '/lernplan/', text: 'Diese Zeit im Lernplan-Generator verteilen →' }))
  );
});

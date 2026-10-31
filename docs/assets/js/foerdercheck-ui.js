import { pruefe, STATUS_TEXT } from './lib/foerdercheck.js';
import { heuteLokal } from './lib/datum.js';
import { el, lies, schreib, SCHLUESSEL } from './speicher.js';

const form = document.getElementById('fc-form');
const out = document.getElementById('fc-result');
const landSel = form.elements.land;
const regionSel = form.elements.region;
let daten = null;

const REGIONEN = {
  AT: [['W', 'Wien'], ['OOE', 'Oberösterreich'], ['NOE', 'Niederösterreich'], ['B', 'Burgenland'], ['ST', 'Steiermark'], ['K', 'Kärnten'], ['S', 'Salzburg'], ['T', 'Tirol'], ['V', 'Vorarlberg']],
  DE: [['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'], ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'], ['NI', 'Niedersachsen'], ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'], ['SL', 'Saarland'], ['SN', 'Sachsen'], ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']]
};

function fuelleRegionen() {
  const alt = regionSel.value;
  regionSel.replaceChildren(...REGIONEN[landSel.value].map(([v, t]) => el('option', { value: v, text: t })));
  if ([...regionSel.options].some(o => o.value === alt)) regionSel.value = alt;
  document.querySelectorAll('[data-nur]').forEach(n => { n.hidden = n.dataset.nur !== landSel.value; });
}
landSel.addEventListener('change', fuelleRegionen);

const gespeichert = lies(SCHLUESSEL.check);
if (gespeichert && typeof gespeichert === 'object') {
  for (const [k, v] of Object.entries(gespeichert)) {
    const f = form.elements[k];
    if (!f || k === 'region') continue;
    if (f.type === 'checkbox') f.checked = !!v; else f.value = v;
  }
}
fuelleRegionen();
if (gespeichert && gespeichert.region) regionSel.value = gespeichert.region;

function werte() {
  const o = {};
  for (const f of form.elements) {
    if (!f.name) continue;
    o[f.name] = f.type === 'checkbox' ? f.checked : f.value;
  }
  return o;
}

const datum = s => s ? s.split('-').reverse().join('.') : '';

function zeige(res) {
  out.replaceChildren();
  const passt = res.ergebnisse.filter(r => r.status === 'passt').length;
  const pruefen = res.ergebnisse.filter(r => r.status === 'pruefen').length;
  out.append(
    el('h3', { tabindex: '-1', id: 'fc-ergebnis' , text: `Ergebnis: ${passt} passend, ${pruefen} zum Prüfen` }),
    el('p', { class: 'note', text: 'Orientierung, verbindlich entscheidet die Förderstelle. Es wird nichts gespeichert oder übertragen, außer Sie setzen unten das Häkchen zum Merken auf diesem Gerät.' })
  );
  for (const r of res.ergebnisse) {
    const box = el('article', { class: 'lamp lamp--' + r.status },
      el('span', { class: 'lamp__dot', 'aria-hidden': 'true' }),
      el('h4', { text: r.name }),
      el('span', { class: 'lamp__state', text: STATUS_TEXT[r.status] }),
      el('p', { text: r.grund }),
      r.schritt ? el('p', {}, el('strong', { text: 'Nächster Schritt: ' }), r.schritt) : null,
      el('p', { class: 'lamp__src' }, `Stand der Quelle: ${datum(r.stand)} · geprüft am ${datum(r.geprueft_am)} · `, el('a', { href: r.quelle_url, rel: 'noopener', text: 'Primärquelle öffnen' }))
    );
    // Spalten-Layout: der Punkt nimmt die erste Spalte ein
    out.append(box);
  }
  const ziel = document.getElementById('fc-weiter');
  if (ziel) ziel.hidden = false;
  document.getElementById('fc-ergebnis').focus();
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  const w = werte();
  if (form.elements.merken.checked) schreib(SCHLUESSEL.check, w); else { try { localStorage.removeItem(SCHLUESSEL.check); } catch {} }
  try {
    if (!daten) daten = await (await fetch('/data/foerderungen.json', { cache: 'no-cache' })).json();
    zeige(pruefe(daten, w, heuteLokal()));
  } catch (e) {
    out.replaceChildren(el('p', { class: 'error', text: 'Die Förderdaten konnten nicht geladen werden. Bitte Seite neu laden.' }));
  }
});

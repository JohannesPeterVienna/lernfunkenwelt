import { neueKarte, bewerte, faellige, verteilung, zuCsv, ausCsv, ausSicherung, zuSicherung, FAECHER } from './lib/karten.js';
import { heuteLokal, kurz, istTag } from './lib/datum.js';
import { el, lies, schreib, loesche, download, SCHLUESSEL } from './speicher.js';

const $ = id => document.getElementById(id);
const heute = heuteLokal();
let stand = lies(SCHLUESSEL.karten) || { karten: [], pruefung: null, merken: false };
if (!Array.isArray(stand.karten)) stand = { karten: [], pruefung: null, merken: false };
let warteschlange = [], aktuell = null, aufgedeckt = false, filter = '';

const BEISPIEL = [
  ['Was besagt der Testeffekt?', 'Wer Stoff aktiv abruft, behält ihn nach Tagen besser als nach erneutem Lesen – auch ohne Rückmeldung.', 'Lernmethoden'],
  ['Wann sollte die erste Wiederholung bei einer Prüfung in 5 Wochen ungefähr liegen?', 'Nach etwa einer Woche; bei längeren Behaltensintervallen wird der Abstand absolut größer, relativ aber kleiner.', 'Lernmethoden'],
  ['Wie viele Unterrichtsstunden muss ein Lehrgang für das Aufstiegs-BAföG mindestens haben?', '400 Unterrichtsstunden zu je 45 Minuten (§ 2 Abs. 3 AFBG).', 'Förderung'],
  ['Was ist bei „seit“ und „seid“ der Unterschied?', '„seit“ ist zeitlich (seit März), „seid“ ist eine Form von „sein“ (ihr seid).', 'Rechtschreibung'],
  ['Welche vier Teilprüfungen hat die Berufsreifeprüfung?', 'Deutsch, Mathematik, eine lebende Fremdsprache und der Fachbereich.', 'Berufsreifeprüfung']
];

function sichern() {
  if (stand.merken) schreib(SCHLUESSEL.karten, stand);
  zeichne();
}

function themen() { return [...new Set(stand.karten.map(k => k.thema).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')); }

function zeichne() {
  $('k-merken').checked = !!stand.merken;
  $('k-pruefung').value = stand.pruefung || '';
  const f = faellige(stand.karten, heute, filter);
  $('k-faellig').textContent = f.length;
  $('k-gesamt').textContent = stand.karten.length;
  const v = verteilung(stand.karten);
  $('k-faecher').replaceChildren(...v.map((n, i) => el('div', {}, el('b', { text: String(n) }), `Fach ${i + 1}`, el('br'), el('span', { class: 'small', text: `${FAECHER[i]} ${FAECHER[i] === 1 ? 'Tag' : 'Tage'}` }))));
  const sel = $('k-thema');
  const alt = sel.value;
  sel.replaceChildren(el('option', { value: '', text: 'Alle Themen' }), ...themen().map(t => el('option', { value: t, text: t })));
  sel.value = themen().includes(alt) ? alt : '';
  const dl = $('k-themenliste');
  dl.replaceChildren(...themen().map(t => el('option', { value: t })));
  // Liste
  const q = $('k-suche').value.trim().toLocaleLowerCase('de');
  const ul = $('k-liste');
  ul.replaceChildren(...stand.karten.filter(k => !q || (k.vorne + ' ' + k.hinten + ' ' + k.thema).toLocaleLowerCase('de').includes(q)).slice(0, 300).map(k =>
    el('li', {}, el('div', {}, el('div', { class: 'q', text: k.vorne }), el('div', { class: 'a', text: k.hinten }), el('div', { class: 'small', text: `${k.thema || 'ohne Thema'} · Fach ${k.fach} · fällig ${kurz(k.faellig)}` })),
      el('button', { type: 'button', class: 'btn btn--ghost btn--small', 'aria-label': 'Karte löschen: ' + k.vorne, text: 'Löschen', onclick: () => { stand.karten = stand.karten.filter(x => x.id !== k.id); sichern(); } }))));
  $('k-leer').hidden = stand.karten.length > 0;
  // Leerer Stapel: nur „Beispielstapel laden“ anbieten, keine Abfrage-Knöpfe
  $('k-leer-aktion').hidden = stand.karten.length > 0;
  if (!stand.karten.length) { $('k-aufdecken').hidden = true; $('k-bewertung').hidden = true; $('k-antwort').hidden = true; }
  // Druckkarten
  const pc = $('k-druck');
  pc.replaceChildren(...stand.karten.slice(0, 200).flatMap(k => [el('div', { class: 'pc', text: k.vorne }), el('div', { class: 'pc', text: k.hinten })]));
}

function naechste() {
  aktuell = warteschlange.shift() || null;
  aufgedeckt = false;
  $('k-antwort').hidden = true;
  $('k-bewertung').hidden = true;
  $('k-aufdecken').hidden = !aktuell;
  if (!aktuell) {
    $('k-frage').textContent = stand.karten.length ? 'Für heute ist nichts mehr fällig.' : 'Noch keine Karten angelegt.';
    $('k-meta').textContent = stand.karten.length ? 'Gut gemacht. Neue Karten tauchen am Fälligkeitstag wieder auf.' : 'Legen Sie unten Karten an oder laden Sie die Beispielkarten.';
    return;
  }
  $('k-meta').textContent = `${aktuell.thema || 'ohne Thema'} · Fach ${aktuell.fach} · noch ${warteschlange.length} danach`;
  $('k-frage').textContent = aktuell.vorne;
  $('k-antwort').textContent = aktuell.hinten;
}

function starte(alle = false) {
  warteschlange = (alle ? stand.karten.filter(k => !filter || k.thema === filter) : faellige(stand.karten, heute, filter)).slice();
  naechste();
  $('k-frage').focus();
}

function bewertung(gewusst) {
  if (!aktuell) return;
  const neu = bewerte(aktuell, gewusst, heute, stand.pruefung);
  stand.karten = stand.karten.map(k => k.id === aktuell.id ? neu : k);
  if (!gewusst) warteschlange.push(neu); // heute noch einmal am Ende der Runde
  sichern();
  naechste();
  $('k-aufdecken').hidden ? $('k-frage').focus() : $('k-aufdecken').focus();
}

$('k-aufdecken').addEventListener('click', () => { aufgedeckt = true; $('k-antwort').hidden = false; $('k-bewertung').hidden = false; $('k-aufdecken').hidden = true; $('k-gewusst').focus(); });
$('k-gewusst').addEventListener('click', () => bewertung(true));
$('k-nicht').addEventListener('click', () => bewertung(false));
$('k-start').addEventListener('click', () => starte(false));
$('k-alle').addEventListener('click', () => starte(true));
$('k-thema').addEventListener('change', e => { filter = e.target.value; zeichne(); });
$('k-suche').addEventListener('input', zeichne);
$('k-merken').addEventListener('change', e => { stand.merken = e.target.checked; if (stand.merken) schreib(SCHLUESSEL.karten, stand); else loesche(SCHLUESSEL.karten); $('k-status').textContent = stand.merken ? 'Karten werden auf diesem Gerät gespeichert.' : 'Gespeicherte Karten auf diesem Gerät gelöscht; die aktuelle Sitzung bleibt bis zum Schließen.'; });
$('k-pruefung').addEventListener('change', e => { stand.pruefung = istTag(e.target.value) ? e.target.value : null; sichern(); });
document.addEventListener('keydown', e => {
  if (!aktuell || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (!aufgedeckt && (e.key === ' ' || e.key === 'Enter') && document.activeElement === $('k-frage')) { e.preventDefault(); $('k-aufdecken').click(); }
  if (aufgedeckt && e.key === '1') bewertung(false);
  if (aufgedeckt && e.key === '2') bewertung(true);
});

$('k-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('k-vorne').value.trim(), h = $('k-hinten').value.trim();
  if (!v || !h) return;
  stand.karten.push(neueKarte(v, h, $('k-neu-thema').value, heute));
  $('k-vorne').value = ''; $('k-hinten').value = '';
  $('k-status').textContent = 'Karte angelegt. Sie ist heute fällig.';
  sichern();
  $('k-vorne').focus();
});
$('k-beispiel').addEventListener('click', () => { BEISPIEL.forEach(([v, h, t], i) => stand.karten.push(neueKarte(v, h, t, heute, 'bsp' + i + Date.now().toString(36)))); sichern(); $('k-status').textContent = 'Fünf Beispielkarten angelegt.'; });
$('k-beispielstapel').addEventListener('click', () => { $('k-beispiel').click(); starte(false); });
$('k-csv-export').addEventListener('click', () => download('karteikarten.csv', zuCsv(stand.karten), 'text/csv;charset=utf-8'));
$('k-json-export').addEventListener('click', () => download('karteikarten-sicherung.json', JSON.stringify(zuSicherung(stand.karten, stand.pruefung), null, 1), 'application/json'));
$('k-drucken').addEventListener('click', () => window.print());
$('k-import').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const text = await f.text();
    let neu;
    if (/\.json$/i.test(f.name) || text.trim().startsWith('{')) { const r = ausSicherung(JSON.parse(text), heute); neu = r.karten; if (r.pruefung && !stand.pruefung) stand.pruefung = r.pruefung; }
    else neu = ausCsv(text, heute);
    const ids = new Set(stand.karten.map(k => k.id));
    neu = neu.filter(k => !ids.has(k.id));
    stand.karten.push(...neu);
    sichern();
    $('k-status').textContent = `${neu.length} Karten übernommen.`;
  } catch (x) { $('k-status').textContent = x.message || 'Datei konnte nicht gelesen werden.'; }
  e.target.value = '';
});
$('k-alles-loeschen').addEventListener('click', () => { if (!confirm('Alle Karten löschen?')) return; stand.karten = []; loesche(SCHLUESSEL.karten); sichern(); naechste(); $('k-status').textContent = 'Alle Karten gelöscht.'; });

zeichne();
naechste();

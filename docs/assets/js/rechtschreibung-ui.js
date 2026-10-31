import { AUFGABEN, THEMEN, runde, auswerten } from './lib/rechtschreibung.js';
import { el, lies, schreib, loesche, SCHLUESSEL } from './speicher.js';

const $ = id => document.getElementById(id);
let st = lies(SCHLUESSEL.rs) || { ergebnisse: {}, merken: false };
if (!st.ergebnisse) st = { ergebnisse: {}, merken: false };
let thema = '', nurFehler = false, liste = [], pos = 0, beantwortet = false, fokus = false;

function sichern() { if (st.merken) schreib(SCHLUESSEL.rs, st); }

function chips() {
  $('rs-themen').replaceChildren(...['', ...THEMEN].map(t => el('button', { type: 'button', class: 'btn btn--ghost btn--small', 'aria-pressed': String(t === thema), text: t || 'Alle Themen', onclick: () => { thema = t; start(); } })));
}

function zusammenfassung() {
  const e = st.ergebnisse;
  const r = Object.values(e).filter(v => v === true).length, f = Object.values(e).filter(v => v === false).length;
  $('rs-richtig').textContent = r; $('rs-fehler').textContent = f; $('rs-offen').textContent = AUFGABEN.length - r - f;
  $('rs-nurfehler').setAttribute('aria-pressed', String(nurFehler));
  $('rs-nurfehler').textContent = nurFehler ? 'Alle Aufgaben zeigen' : `Nur zuletzt falsche (${f})`;
}

function start() {
  liste = runde(AUFGABEN, thema, nurFehler, st.ergebnisse, Date.now() % 100000);
  pos = 0; chips(); zeige();
}

function zeige() {
  zusammenfassung();
  beantwortet = false;
  $('rs-feedback').hidden = true; $('rs-weiter').hidden = true;
  $('rs-fortschritt').style.width = liste.length ? Math.round(pos / liste.length * 100) + '%' : '0%';
  $('rs-schritt').textContent = liste.length ? `Aufgabe ${Math.min(pos + 1, liste.length)} von ${liste.length}` : 'Keine Aufgaben in dieser Auswahl';
  const box = $('rs-antworten');
  box.replaceChildren();
  if (pos >= liste.length) {
    $('rs-thema').textContent = 'Runde beendet';
    $('rs-satz').textContent = liste.length ? 'Das war die Runde. Wiederholen Sie gezielt die Fehler oder wählen Sie ein anderes Thema.' : 'Hier gibt es gerade nichts zu wiederholen.';
    box.append(el('button', { type: 'button', class: 'btn', text: 'Neue Runde', onclick: start }));
    return;
  }
  const a = liste[pos];
  $('rs-thema').textContent = a.thema;
  $('rs-satz').textContent = a.satz;
  a.optionen.forEach((o, i) => box.append(el('button', { type: 'button', class: 'btn btn--ghost', text: o, onclick: ev => waehle(a, i, ev.currentTarget) })));
  if (fokus) box.firstElementChild.focus({ preventScroll: true });
  fokus = true;
}

function waehle(a, i) {
  if (beantwortet) return;
  beantwortet = true;
  const r = auswerten(a, i);
  st.ergebnisse[a.id] = r.richtig; sichern();
  [...$('rs-antworten').children].forEach((b, j) => { b.disabled = true; if (j === a.loesung) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
  const fb = $('rs-feedback');
  fb.className = 'feedback ' + (r.richtig ? 'feedback--good' : 'feedback--learn');
  fb.replaceChildren(el('strong', { text: r.richtig ? 'Richtig. ' : `Richtig wäre: ${r.loesung}. ` }), r.erklaerung);
  fb.hidden = false;
  $('rs-weiter').hidden = false; $('rs-weiter').focus();
  zusammenfassung();
}

$('rs-weiter').addEventListener('click', () => { pos++; zeige(); });
$('rs-nurfehler').addEventListener('click', () => { nurFehler = !nurFehler; start(); });
$('rs-merken').checked = !!st.merken;
$('rs-merken').addEventListener('change', e => { st.merken = e.target.checked; if (st.merken) sichern(); else loesche(SCHLUESSEL.rs); });
$('rs-reset').addEventListener('click', () => { if (!confirm('Übungsstand zurücksetzen?')) return; st.ergebnisse = {}; sichern(); start(); $('rs-status').textContent = 'Übungsstand zurückgesetzt.'; });
start();

import { erstelle, verschiebe, auslastung, pruefeSicherung } from './lib/lernplan.js';
import { erzeugeIcs } from './lib/ics.js';
import { heuteLokal, plusTage, kurz, kalenderwoche, differenz } from './lib/datum.js';
import { VORLAGEN } from './vorlagen.js';
import { el, lies, schreib, loesche, download, SCHLUESSEL } from './speicher.js';

const $ = id => document.getElementById(id);
const form = $('lp-form');
const liste = $('lp-themen');
const out = $('lp-result');
const status = $('lp-status');
const heute = heuteLokal();
let plan = null;

const WT = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function themaZeile(name = '', stufe = 'mittel', stunden = '') {
  const id = 't' + Math.random().toString(36).slice(2, 8);
  const row = el('div', { class: 'topic-row' },
    el('div', { class: 'field' }, el('label', { for: id + 'n', text: 'Thema' }), el('input', { type: 'text', id: id + 'n', name: 'thema', value: name, maxlength: '80', required: true })),
    el('div', { class: 'field' }, el('label', { for: id + 's', text: 'Schwierigkeit' }),
      (() => { const s = el('select', { id: id + 's', name: 'stufe' }, ['leicht', 'mittel', 'schwer'].map(v => el('option', { value: v, text: v }))); s.value = stufe; return s; })()),
    el('button', { type: 'button', class: 'btn btn--ghost btn--small', 'aria-label': 'Thema entfernen', text: 'Entfernen', onclick: () => { row.remove(); } })
  );
  if (stunden) row.dataset.stunden = stunden;
  liste.append(row);
}

function ladeVorlage(key) {
  const v = VORLAGEN[key];
  if (!v) return;
  liste.replaceChildren();
  v.themen.forEach(([n, s, h]) => themaZeile(n, s, h));
  status.textContent = `Vorlage „${v.titel}“ geladen: ${v.themen.length} Themen. Passen Sie Namen und Schwierigkeit an Ihren Stand an.`;
}

function minutenFelder() {
  const box = $('lp-minuten');
  const std = [60, 60, 0, 60, 0, 120, 90];
  WT.forEach((w, i) => {
    box.append(el('div', { class: 'field' }, el('label', { for: 'm' + i, text: w }), el('input', { type: 'number', id: 'm' + i, name: 'm' + i, min: '0', max: '600', step: '15', value: String(std[i]), inputmode: 'numeric' })));
  });
}

function eingabe() {
  const themen = [...liste.querySelectorAll('.topic-row')].map(r => ({
    name: r.querySelector('[name=thema]').value.trim(),
    stufe: r.querySelector('[name=stufe]').value,
    stunden: r.dataset.stunden ? Number(r.dataset.stunden) : undefined
  })).filter(t => t.name);
  const sperr = form.elements.sperrtage.value.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
  });
  return {
    start: form.elements.start.value, pruefung: form.elements.pruefung.value, themen,
    minuten: WT.map((_, i) => Number(form.elements['m' + i].value) || 0),
    sperrtage: sperr, puffer: Number(form.elements.puffer.value) || 0
  };
}

const ART = { neu: 'neu', wiederholung: 'Wiederholung', abruf: 'Abruf' };

function boegen(p) {
  // Wiederholungsbögen: je Thema Bögen zwischen Erstbearbeitung und Wiederholungen
  const n = p.tage.length + 1, W = 640, H = 120, x = i => 10 + i * (W - 20) / n;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'arcs'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Wiederholungsbögen: Abstände zwischen Lernen und Wiederholen wachsen bis zur Prüfung.');
  const ns = 'http://www.w3.org/2000/svg';
  const base = document.createElementNS(ns, 'line');
  Object.entries({ x1: 10, x2: W - 10, y1: H - 14, y2: H - 14, stroke: 'currentColor', 'stroke-opacity': '.4' }).forEach(([k, v]) => base.setAttribute(k, v));
  svg.append(base);
  const pos = {};
  p.tage.forEach((t, i) => t.bloecke.forEach(b => { (pos[b.ti ?? b.thema] ||= []).push({ i, art: b.art }); }));
  Object.values(pos).slice(0, 12).forEach(arr => {
    const pts = []; let lastNeu = null;
    for (const a of arr) { if (a.art === 'neu') lastNeu = a.i; else if (lastNeu != null) pts.push(a.i); }
    let prev = lastNeu;
    for (const q of pts) {
      if (prev == null) { prev = q; continue; }
      const x0 = x(prev), x1 = x(q), hgt = Math.min(H - 24, 10 + (x1 - x0) * 0.5);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x0} ${H - 14} Q${(x0 + x1) / 2} ${H - 14 - hgt * 2} ${x1} ${H - 14}`);
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'var(--accent)'); path.setAttribute('stroke-opacity', '.55'); path.setAttribute('stroke-width', '1.5');
      svg.append(path); prev = q;
    }
  });
  const dot = document.createElementNS(ns, 'circle');
  const ti = Math.max(0, differenz(p.start, heute));
  if (ti <= n) { Object.entries({ cx: x(ti), cy: H - 14, r: 6, fill: 'var(--spark)' }).forEach(([k, v]) => dot.setAttribute(k, v)); svg.append(dot); }
  const ende = document.createElementNS(ns, 'rect');
  Object.entries({ x: x(n) - 6, y: H - 26, width: 12, height: 12, fill: 'var(--ink)' }).forEach(([k, v]) => ende.setAttribute(k, v));
  svg.append(ende);
  return svg;
}

function zeige(p, meldung) {
  plan = p;
  out.replaceChildren();
  const last = auslastung(p);
  const std = m => (m / 60).toLocaleString('de-AT', { maximumFractionDigits: 1 });
  out.append(el('h3', { id: 'lp-ergebnis', tabindex: '-1', text: p.passt ? 'Ihr Plan passt' : 'Der Plan passt noch nicht' }));
  if (meldung) out.append(el('p', { role: 'status', text: meldung }));
  if (!p.passt) out.append(el('p', { class: 'note', text: `Es fehlen etwa ${std(p.fehlend)} Stunden. Prüfungstermin später legen, mehr Minuten pro Woche eintragen, den Puffer senken oder Themen kürzen.` }));
  else if (p.ueberzug) out.append(el('p', { class: 'note', text: 'Der Plan geht auf, aber neuer Stoff reicht über 60 % der Zeit hinaus. Dadurch bleibt weniger Raum für Wiederholungen.' }));
  out.append(el('p', {}, `${p.themen.length} Themen, ${std(p.geplant)} Stunden eingeplant bei ${std(p.kapazitaet)} Stunden verfügbarer Zeit (nach ${p.puffer} % Puffer). Ab `, el('strong', { text: kurz(p.abrufStart) }), ' nur noch Abruf, kein neuer Stoff.'));
  out.append(boegen(p));

  const aktionen = el('div', { class: 'btn-row no-print' },
    el('button', { type: 'button', class: 'btn', text: 'Kalenderdatei (.ics) laden', onclick: icsLaden }),
    el('button', { type: 'button', class: 'btn btn--ghost', text: 'Drucken / PDF', onclick: () => window.print() }),
    el('button', { type: 'button', class: 'btn btn--ghost', text: 'Sicherung (.json) speichern', onclick: () => download('lernplan-sicherung.json', JSON.stringify(plan, null, 1), 'application/json') }),
    el('button', { type: 'button', class: 'btn btn--ghost', text: 'Verpasstes auf freie Tage verschieben', onclick: neuPlanen })
  );
  const icsOpt = el('div', { class: 'cols no-print' },
    el('div', { class: 'field' }, el('label', { for: 'ics-beginn', text: 'Uhrzeit des ersten Blocks' }), el('input', { type: 'time', id: 'ics-beginn', value: '18:30' })),
    el('div', { class: 'field' }, el('label', { for: 'ics-alarm', text: 'Erinnerung' }),
      el('select', { id: 'ics-alarm' }, el('option', { value: '', text: 'keine' }), el('option', { value: '10', text: '10 Minuten vorher' }), el('option', { value: '30', text: '30 Minuten vorher' }), el('option', { value: '60', text: '1 Stunde vorher' })))
  );
  out.append(icsOpt, aktionen);

  // Auslastung je Woche (kompakt)
  const wochen = new Map();
  p.tage.forEach((t, i) => {
    const k0 = kalenderwoche(t.datum), m0 = Number(t.datum.slice(5, 7)), y0 = Number(t.datum.slice(0, 4));
    const kw = k0 + '/' + (m0 === 1 && k0 > 50 ? y0 - 1 : m0 === 12 && k0 === 1 ? y0 + 1 : y0);
    if (!wochen.has(kw)) wochen.set(kw, []);
    wochen.get(kw).push({ t, l: last[i] });
  });
  const tabelle = el('div', { class: 'card', style: 'margin:1.5rem 0' }, el('h4', { style: 'margin-top:0', text: 'Auslastung je Woche' }));
  for (const [kw, tage] of wochen) {
    const min = tage.reduce((s, x) => s + x.l.min, 0), kap = tage.reduce((s, x) => s + x.l.kap, 0);
    const pr = kap ? Math.min(100, Math.round(min / kap * 100)) : 0;
    tabelle.append(el('div', { class: 'loadbar' }, el('span', { class: 'num', text: 'KW ' + kw.split('/')[0] }),
      el('span', { class: 'loadbar__bar', role: 'img', 'aria-label': `${pr} Prozent ausgelastet` }, el('span', { style: `width:${pr}%` })),
      el('span', { class: 'num', text: std(min) + ' h' })));
  }
  out.append(tabelle);

  // Tagesliste
  const tageBox = el('div', { class: 'plan-days' }, el('h4', { text: 'Tagesliste' }));
  let aktKw = null, wochenBox = null;
  p.tage.forEach((t, ti) => {
    if (!t.bloecke.length) return;
    const kw = kalenderwoche(t.datum);
    if (kw !== aktKw) { aktKw = kw; wochenBox = el('section', { class: 'week' }, el('h4', { text: `Kalenderwoche ${kw}` })); tageBox.append(wochenBox); }
    const ul = el('ul', { class: 'blocks' });
    t.bloecke.forEach((b, bi) => {
      const cid = `b-${ti}-${bi}`;
      const cb = el('input', { type: 'checkbox', id: cid, checked: b.erledigt || null, onchange: e => { b.erledigt = e.target.checked; li.classList.toggle('block--done', b.erledigt); speichern(); } });
      const li = el('li', { class: 'block' + (b.erledigt ? ' block--done' : '') }, cb,
        el('label', { for: cid, class: 'block__txt' }, el('span', { class: 'tag tag--' + b.art, text: ART[b.art] }), ' ', b.thema, ' ', el('span', { class: 'num', text: `· ${b.min} min` })));
      ul.append(li);
    });
    wochenBox.append(el('div', { class: 'day' + (t.datum === heute ? ' day--today' : '') }, el('time', { class: 'day__date', datetime: t.datum, text: kurz(t.datum) }), ul));
  });
  out.append(tageBox);
  speichern();
  $('lp-ergebnis').focus();
  const hinweis = $('lp-karten-hinweis');
  if (hinweis) hinweis.hidden = false;
}

function speichern() {
  if (!plan) return;
  if (form.elements.merken.checked) schreib(SCHLUESSEL.plan, plan);
}

function icsLaden() {
  const alarm = $('ics-alarm').value;
  const { text, ereignisse } = erzeugeIcs(plan, { beginn: $('ics-beginn').value || '18:30', alarm: alarm === '' ? null : Number(alarm), tz: form.elements.zeitzone.value });
  download('lernplan.ics', text, 'text/calendar;charset=utf-8');
  status.textContent = `Kalenderdatei mit ${ereignisse} Terminen erstellt. Öffnen Sie sie mit Outlook, Google Kalender oder Apple Kalender.`;
}

function neuPlanen() {
  const r = verschiebe(plan, heute);
  zeige(r.plan, r.verschoben ? `${r.verschoben} verpasste Blöcke wurden auf die nächsten freien Tage gelegt.` + (r.nichtPlatziert ? ` ${r.nichtPlatziert} Minuten fanden keinen Platz mehr.` : '') : 'Keine verpassten, unerledigten Blöcke vor heute gefunden.');
}

form.addEventListener('submit', ev => {
  ev.preventDefault();
  const e = eingabe();
  const r = erstelle(e);
  const err = $('lp-fehler');
  if (!r.ok) { err.textContent = r.fehler.join(' '); err.hidden = false; err.focus(); return; }
  err.hidden = true;
  zeige(r);
});

$('lp-add').addEventListener('click', () => { themaZeile(); liste.lastElementChild.querySelector('input').focus(); });
$('lp-vorlage').addEventListener('change', e => { if (e.target.value) ladeVorlage(e.target.value); });
$('lp-import').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const p = pruefeSicherung(JSON.parse(await f.text())); zeige(p, 'Sicherung eingelesen.'); }
  catch (x) { status.textContent = x.message || 'Datei konnte nicht gelesen werden.'; }
  e.target.value = '';
});
$('lp-loeschen').addEventListener('click', () => {
  if (!confirm('Gespeicherten Lernplan auf diesem Gerät löschen?')) return;
  loesche(SCHLUESSEL.plan); plan = null; out.replaceChildren(); status.textContent = 'Der gespeicherte Lernplan wurde gelöscht.';
});

// Start
minutenFelder();
form.elements.start.value = heute;
form.elements.pruefung.value = plusTage(heute, 84);
const q = new URLSearchParams(location.search);
if (q.get('vorlage') && VORLAGEN[q.get('vorlage')]) { $('lp-vorlage').value = q.get('vorlage'); ladeVorlage(q.get('vorlage')); }
else { themaZeile('Grundlagen wiederholen', 'leicht'); themaZeile('Kernthema 1', 'mittel'); themaZeile('Kernthema 2', 'schwer'); }
const alt = lies(SCHLUESSEL.plan);
if (alt) { try { form.elements.merken.checked = true; zeige(pruefeSicherung(alt), 'Ihr gespeicherter Plan wurde geladen.'); } catch { loesche(SCHLUESSEL.plan); } }

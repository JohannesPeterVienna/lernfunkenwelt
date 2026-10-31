// Karteikarten mit fünf Fächern. Abstände wachsen je Fach, werden aber auf den
// Tag vor der Prüfung gekappt, damit keine Karte erst nach der Prüfung fällig wird.

import { istTag, plusTage, differenz } from './datum.js';

export const FAECHER = [1, 2, 4, 8, 16]; // Tage je Fach (1–5)
export const MAX_KARTEN = 2000;

export function neueKarte(vorne, hinten, thema, heute, id) {
  return { id: id || 'k' + Math.random().toString(36).slice(2, 10), vorne: String(vorne).trim().slice(0, 500), hinten: String(hinten).trim().slice(0, 2000), thema: String(thema || '').trim().slice(0, 80), fach: 1, faellig: heute, gesehen: 0 };
}

/** Bewertung: gewusst → nächstes Fach, nicht gewusst → Fach 1, morgen. */
export function bewerte(karte, gewusst, heute, pruefung = null) {
  const fach = gewusst ? Math.min(karte.fach + 1, FAECHER.length) : 1;
  let abstand = gewusst ? FAECHER[fach - 1] : 1;
  if (pruefung && istTag(pruefung)) {
    const bis = differenz(heute, pruefung) - 1;
    if (bis >= 1) abstand = Math.min(abstand, bis);
    else abstand = 1;
  }
  return { ...karte, fach, faellig: plusTage(heute, abstand), gesehen: karte.gesehen + 1 };
}

export function faellige(karten, heute, thema = '') {
  return karten.filter(k => k.faellig <= heute && (!thema || k.thema === thema));
}

export function verteilung(karten) {
  const v = [0, 0, 0, 0, 0];
  for (const k of karten) v[k.fach - 1]++;
  return v;
}

// ---- CSV (Vorderseite;Rückseite;Thema) ----
function csvFeld(s) {
  s = String(s ?? '');
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function zuCsv(karten) {
  return '﻿Vorderseite;Rückseite;Thema\r\n' + karten.map(k => [k.vorne, k.hinten, k.thema].map(csvFeld).join(';')).join('\r\n') + '\r\n';
}

/** Liest CSV mit Semikolon (auch Komma oder Tab, falls keine Semikola), mit Anführungszeichen. */
export function ausCsv(text, heute) {
  text = String(text).replace(/^﻿/, '');
  const erste = text.split(/\r?\n/)[0] || '';
  const sep = erste.includes(';') ? ';' : erste.includes('\t') ? '\t' : ',';
  const zeilen = [];
  let feld = '', zeile = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') q = false;
      else feld += c;
    } else if (c === '"') q = true;
    else if (c === sep) { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld); zeilen.push(zeile); zeile = []; feld = '';
    } else feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  const out = [];
  zeilen.forEach((z, i) => {
    if (i === 0 && /^vorder/i.test((z[0] || '').trim())) return;
    if (!z[0] || !z[0].trim() || !z[1] || !z[1].trim()) return;
    out.push(neueKarte(z[0], z[1], z[2] || '', heute, 'k' + i + '-' + Math.random().toString(36).slice(2, 7)));
  });
  if (out.length > MAX_KARTEN) throw new Error(`Höchstens ${MAX_KARTEN} Karten je Import.`);
  return out;
}

/** Sicherungsdatei von Lernfunkenwelt oder (zur Übernahme) des früheren Abruftrainers. */
export function ausSicherung(obj, heute) {
  if (obj && obj.format === 'lernfunkenwelt-karten' && Array.isArray(obj.karten)) {
    if (obj.karten.length > MAX_KARTEN) throw new Error('Zu viele Karten in der Datei.');
    return { karten: obj.karten.map(k => {
      if (typeof k.vorne !== 'string' || typeof k.hinten !== 'string' || !istTag(k.faellig) || !(k.fach >= 1 && k.fach <= 5)) throw new Error('Eine Karte ist ungültig.');
      return { id: String(k.id || '').slice(0, 40) || neueKarte('', '', '', heute).id, vorne: k.vorne.slice(0, 500), hinten: k.hinten.slice(0, 2000), thema: String(k.thema || '').slice(0, 80), fach: Math.round(k.fach), faellig: k.faellig, gesehen: Math.max(0, Number(k.gesehen) || 0) };
    }), pruefung: istTag(obj.pruefung) ? obj.pruefung : null };
  }
  // Übernahme aus abruf.lernfunkenwelt.de: {version:1, cards:[{id,front,back,level 0–5,due,reviews}]}
  if (obj && obj.version === 1 && Array.isArray(obj.cards)) {
    if (obj.cards.length > MAX_KARTEN) throw new Error('Zu viele Karten in der Datei.');
    return { karten: obj.cards.filter(c => c && typeof c.front === 'string' && typeof c.back === 'string').map((c, i) => ({
      id: 'alt-' + i + '-' + String(c.id || '').slice(0, 20), vorne: c.front.trim().slice(0, 500), hinten: c.back.trim().slice(0, 2000), thema: 'Übernommen',
      fach: Math.min(5, Math.max(1, (Number(c.level) || 0) + 1)), faellig: istTag(c.due) ? c.due : heute, gesehen: Math.max(0, Number(c.reviews) || 0)
    })), pruefung: null };
  }
  throw new Error('Diese Datei ist keine Karteikarten-Sicherung.');
}

export function zuSicherung(karten, pruefung) {
  return { format: 'lernfunkenwelt-karten', version: 1, pruefung: pruefung || null, karten };
}

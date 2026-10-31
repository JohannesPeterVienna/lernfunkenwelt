// Lernplan-Algorithmus: Rückwärtsplanung vom Prüfungstag mit verteilten Wiederholungen.
// Die Abstände folgen den Optima von Cepeda, Vul, Rohrer, Wixted & Pashler (2008):
// interpolierte Optimalabstände ca. 43 % (7 Tage), 23 % (35), 17 % (70), 8 % (350 Tage)
// des Behaltensintervalls bei freiem Abruf. Die Studie prüfte eine einzige Wiederholung;
// die wiederholte Anwendung auf das jeweils verbleibende Intervall ist unsere Ableitung.

import { istTag, plusTage, differenz, wochentag } from './datum.js';

/** Stützstellen: Behaltensintervall in Tagen → Anteil des Intervalls als nächster Abstand. */
export const STUETZEN = [[7, 0.43], [35, 0.23], [70, 0.17], [350, 0.08]];

export function abstandsAnteil(ri) {
  if (ri <= STUETZEN[0][0]) return STUETZEN[0][1];
  const last = STUETZEN[STUETZEN.length - 1];
  if (ri >= last[0]) return last[1];
  for (let i = 0; i < STUETZEN.length - 1; i++) {
    const [x0, y0] = STUETZEN[i], [x1, y1] = STUETZEN[i + 1];
    if (ri >= x0 && ri <= x1) {
      const t = (Math.log(ri) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** Nächster Abstand in Tagen für ein verbleibendes Behaltensintervall (mind. 1 Tag). */
export function naechsterAbstand(ri) {
  return Math.max(1, Math.round(abstandsAnteil(ri) * ri));
}

export const GEWICHT = { leicht: 3, mittel: 6, schwer: 10 };

export function wiederholungsMinuten(neuMin) {
  return Math.min(60, Math.max(15, Math.round(neuMin * 0.15 / 5) * 5));
}
export function abrufMinuten(neuMin) {
  return Math.min(45, Math.max(15, Math.round(neuMin * 0.1 / 5) * 5));
}

/**
 * Wiederholungstage (Index relativ zum Start) für ein Thema, dessen Erstbearbeitung am Tag d0 endet.
 * @param {number} d0 letzter Tag der Erstbearbeitung
 * @param {number} pruefung Index des Prüfungstags
 * @param {number} abrufStart erster Tag der reinen Abrufphase
 */
export function wiederholungsTage(d0, pruefung, abrufStart) {
  const tage = [];
  let cur = d0;
  for (let guard = 0; guard < 60; guard++) {
    const ri = pruefung - cur;
    const next = cur + naechsterAbstand(ri);
    if (next >= abrufStart) break;
    tage.push(next);
    cur = next;
  }
  if (!tage.length && d0 + 1 < abrufStart) tage.push(d0 + 1);
  return tage;
}

function validiere(e) {
  const fehler = [];
  if (!istTag(e.start)) fehler.push('Bitte ein gültiges Startdatum eintragen.');
  if (!istTag(e.pruefung)) fehler.push('Bitte ein gültiges Prüfungsdatum eintragen.');
  if (!fehler.length && differenz(e.start, e.pruefung) < 3) fehler.push('Zwischen Start und Prüfung sollten mindestens drei Tage liegen.');
  if (!fehler.length && differenz(e.start, e.pruefung) > 730) fehler.push('Der Plan ist auf höchstens zwei Jahre ausgelegt.');
  if (!Array.isArray(e.themen) || !e.themen.length) fehler.push('Bitte mindestens ein Thema eintragen.');
  if (!Array.isArray(e.minuten) || e.minuten.length !== 7 || e.minuten.every(m => !(m > 0))) fehler.push('Bitte für mindestens einen Wochentag Lernminuten eintragen.');
  return fehler;
}

/**
 * Erstellt einen Lernplan.
 * @param {{start:string, pruefung:string, themen:{name:string, stufe?:string, stunden?:number}[],
 *          minuten:number[], sperrtage?:string[], puffer?:number}} e
 */
export function erstelle(e) {
  const fehler = validiere(e);
  if (fehler.length) return { ok: false, fehler };
  const puffer = Math.min(50, Math.max(0, Number(e.puffer) || 0));
  const sperr = new Set((e.sperrtage || []).filter(istTag));
  const n = differenz(e.start, e.pruefung); // Lerntage: Index 0 … n-1, Prüfung = n
  const tage = [];
  for (let i = 0; i < n; i++) {
    const datum = plusTage(e.start, i);
    const roh = sperr.has(datum) ? 0 : Math.max(0, Math.round(Number(e.minuten[wochentag(datum)]) || 0));
    const kap = Math.floor(roh * (1 - puffer / 100));
    tage.push({ datum, roh, kap, frei: kap, gesperrt: sperr.has(datum), bloecke: [] });
  }
  const abrufLaenge = n >= 21 ? 7 : Math.max(1, Math.round(n * 0.2));
  const abrufStart = n - abrufLaenge;
  const neuEnde = Math.max(1, Math.floor(n * 0.6));

  const themen = e.themen.map((t, i) => {
    const neu = Math.round((Number(t.stunden) > 0 ? Number(t.stunden) : GEWICHT[t.stufe] || GEWICHT.mittel) * 60);
    return { i, name: String(t.name || `Thema ${i + 1}`).slice(0, 80), stufe: t.stufe || 'mittel', neu, rest: neu, fertig: null, wdh: wiederholungsMinuten(neu), abruf: abrufMinuten(neu) };
  });

  let fehlend = 0, ueberzug = false;
  const offen = []; // {thema, min, ziel}
  let tIdx = 0;
  const lege = (tag, thema, art, min) => {
    tag.bloecke.push({ id: `${tag.datum}-${tag.bloecke.length}`, thema: thema.name, ti: thema.i, art, min, erledigt: false });
    tag.frei -= min;
  };

  for (let d = 0; d < abrufStart; d++) {
    const tag = tage[d];
    // 1. fällige Wiederholungen zuerst (verspätete rollen weiter)
    offen.sort((a, b) => a.ziel - b.ziel);
    for (let k = 0; k < offen.length; k++) {
      const o = offen[k];
      if (o.ziel > d) break;
      if (tag.frei >= o.min) { lege(tag, o.thema, 'wiederholung', o.min); offen.splice(k, 1); k--; }
    }
    // 2. neuer Stoff
    while (tIdx < themen.length && tag.frei >= 15) {
      const th = themen[tIdx];
      if (d >= neuEnde) ueberzug = true;
      const min = Math.min(th.rest, tag.frei);
      if (min < 15 && th.rest > min) break;
      lege(tag, th, 'neu', min);
      th.rest -= min;
      if (th.rest <= 0) {
        th.fertig = d;
        for (const z of wiederholungsTage(d, n, abrufStart)) offen.push({ thema: th, min: th.wdh, ziel: z });
        tIdx++;
      }
    }
  }
  // Nicht eingeplanter neuer Stoff
  for (let k = tIdx; k < themen.length; k++) fehlend += themen[k].rest;
  // Wiederholungen, die vor der Abrufphase keinen Platz fanden, wandern in die Abrufphase
  const abrufBedarf = [];
  for (const o of offen) abrufBedarf.push({ thema: o.thema, min: o.min, art: 'wiederholung' });
  // Abrufphase: jedes fertige Thema einmal abrufen, schwere Themen zweimal, falls Zeit
  const fertige = themen.filter(t => t.fertig != null);
  for (const t of fertige) abrufBedarf.push({ thema: t, min: t.abruf, art: 'abruf' });
  for (const t of fertige) if (t.stufe === 'schwer' && abrufLaenge >= 4) abrufBedarf.push({ thema: t, min: t.abruf, art: 'abruf', spaet: true });
  // gleichmäßig über die Abrufphase verteilen
  const abrufTage = tage.slice(abrufStart);
  abrufBedarf.forEach((b, k) => {
    const ziel = b.spaet ? abrufTage.length - 1 - (k % Math.max(1, Math.ceil(abrufTage.length / 2))) : Math.floor(k * abrufTage.length / Math.max(1, abrufBedarf.length));
    let platziert = false;
    for (let s = 0; s < abrufTage.length && !platziert; s++) {
      const idx = (Math.max(0, ziel) + s) % abrufTage.length;
      const tag = abrufTage[idx];
      if (tag.frei >= b.min) { lege(tag, b.thema, b.art, b.min); platziert = true; }
    }
    if (!platziert) fehlend += b.min;
  });
  for (const tag of tage) tag.bloecke.sort((a, b) => ({ wiederholung: 0, abruf: 1, neu: 2 }[a.art] - { wiederholung: 0, abruf: 1, neu: 2 }[b.art]));

  const bedarf = themen.reduce((s, t) => s + t.neu, 0) + fertige.reduce((s, t) => s + 0, 0);
  const geplant = tage.reduce((s, t) => s + t.bloecke.reduce((a, b) => a + b.min, 0), 0);
  const kapazitaet = tage.reduce((s, t) => s + t.kap, 0);
  return {
    ok: true,
    version: 1,
    start: e.start,
    pruefung: e.pruefung,
    puffer,
    abrufStart: tage[abrufStart] ? tage[abrufStart].datum : e.pruefung,
    themen: themen.map(t => ({ name: t.name, stufe: t.stufe, neu: t.neu, fertig: t.fertig == null ? null : tage[t.fertig].datum })),
    tage: tage.map(({ datum, roh, kap, gesperrt, bloecke }) => ({ datum, roh, kap, gesperrt, bloecke })),
    geplant,
    kapazitaet,
    bedarfNeu: bedarf,
    fehlend,
    ueberzug,
    passt: fehlend === 0
  };
}

/**
 * Verschiebt nicht erledigte Blöcke vor `heute` auf freie Kapazität ab `heute`.
 * Gibt einen neuen Plan zurück (der alte bleibt unverändert).
 */
export function verschiebe(plan, heute) {
  const p = JSON.parse(JSON.stringify(plan));
  const verpasst = [];
  for (const t of p.tage) {
    if (t.datum >= heute) continue;
    const rest = [];
    for (const b of t.bloecke) (b.erledigt ? rest : verpasst).push(b);
    t.bloecke = rest;
  }
  let nichtPlatziert = 0, verschoben = 0;
  for (const b of verpasst) {
    const ziel = p.tage.find(t => t.datum >= heute && t.kap - t.bloecke.reduce((s, x) => s + x.min, 0) >= b.min);
    if (ziel) { ziel.bloecke.push({ ...b, id: `${ziel.datum}-${ziel.bloecke.length}-v` }); verschoben++; }
    else nichtPlatziert += b.min;
  }
  p.fehlend = (p.fehlend || 0) + nichtPlatziert;
  p.passt = p.fehlend === 0;
  return { plan: p, verschoben, nichtPlatziert };
}

/** Minuten-Auslastung je Tag in Prozent der (gepufferten) Kapazität. */
export function auslastung(plan) {
  return plan.tage.map(t => {
    const min = t.bloecke.reduce((s, b) => s + b.min, 0);
    return { datum: t.datum, min, kap: t.kap, prozent: t.kap ? Math.round(min / t.kap * 100) : 0 };
  });
}

/** Prüft eine eingelesene Sicherungsdatei. */
export function pruefeSicherung(obj) {
  if (!obj || obj.version !== 1 || !istTag(obj.start) || !istTag(obj.pruefung) || !Array.isArray(obj.tage) || obj.tage.length > 800) throw new Error('Die Datei ist keine gültige Lernplan-Sicherung.');
  for (const t of obj.tage) {
    if (!istTag(t.datum) || !Array.isArray(t.bloecke)) throw new Error('Die Datei enthält einen ungültigen Tag.');
    for (const b of t.bloecke) if (typeof b.thema !== 'string' || !['neu', 'wiederholung', 'abruf'].includes(b.art) || !(b.min > 0)) throw new Error('Die Datei enthält einen ungültigen Lernblock.');
  }
  return obj;
}

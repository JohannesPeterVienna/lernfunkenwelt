// iCalendar-Export nach RFC 5545: CRLF-Zeilenenden, gefaltete Zeilen ≤ 75 Oktette,
// DTSTAMP und eindeutige UID je Ereignis, maskierte Sonderzeichen.

export function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Faltet eine Inhaltszeile auf höchstens 75 Oktette (UTF-8), Folgezeilen beginnen mit Leerzeichen. */
export function falte(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const teile = [];
  let cur = '', len = 0, limit = 75;
  for (const ch of line) {
    const l = enc.encode(ch).length;
    if (len + l > limit) { teile.push(cur); cur = ' '; len = 1; limit = 75; }
    cur += ch; len += l;
  }
  teile.push(cur);
  return teile.join('\r\n');
}

const pad = n => String(n).padStart(2, '0');
export function utcStempel(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function lokal(datum, minuten) {
  const [y, m, d] = datum.split('-');
  return `${y}${m}${d}T${pad(Math.floor(minuten / 60))}${pad(minuten % 60)}00`;
}

const ART = { neu: 'Neu lernen', wiederholung: 'Wiederholen', abruf: 'Abrufen' };

/** Kleine, deterministische Prüfsumme für stabile UIDs (FNV-1a). */
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/**
 * @param {object} plan Lernplan aus lernplan.erstelle
 * @param {{beginn?:string, alarm?:number|null, jetzt?:Date, tz?:string}} opt
 */
export function erzeugeIcs(plan, opt = {}) {
  const tz = opt.tz || 'Europe/Vienna';
  const [h, m] = (opt.beginn || '18:30').split(':').map(Number);
  const start0 = (h || 0) * 60 + (m || 0);
  const stamp = utcStempel(opt.jetzt || new Date());
  const planId = hash(plan.start + plan.pruefung + plan.themen.map(t => t.name).join('|'));
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lernfunkenwelt//Lernplan 1.0//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + escapeText('Lernplan bis ' + plan.pruefung.split('-').reverse().join('.')),
    'X-WR-TIMEZONE:' + tz
  ];
  if (tz === 'Europe/Vienna' || tz === 'Europe/Berlin') {
    L.push('BEGIN:VTIMEZONE', 'TZID:' + tz,
      'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:MESZ', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:MEZ', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
      'END:VTIMEZONE');
  }
  let n = 0;
  for (const t of plan.tage) {
    let off = start0;
    t.bloecke.forEach((b, i) => {
      const von = off, bis = off + b.min;
      off = bis + 5;
      if (bis >= 24 * 60) return;
      n++;
      L.push('BEGIN:VEVENT',
        `UID:${planId}-${t.datum.replace(/-/g, '')}-${i}@lernfunkenwelt.de`,
        'DTSTAMP:' + stamp,
        `DTSTART;TZID=${tz}:${lokal(t.datum, von)}`,
        `DTEND;TZID=${tz}:${lokal(t.datum, bis)}`,
        'SUMMARY:' + escapeText(`${ART[b.art]}: ${b.thema}`),
        'DESCRIPTION:' + escapeText(`${b.min} Minuten. ${b.art === 'neu' ? 'Neuen Stoff durcharbeiten und am Ende drei Fragen dazu notieren.' : b.art === 'wiederholung' ? 'Erst ohne Unterlagen aufschreiben, was Sie noch wissen, dann vergleichen.' : 'Nur abrufen: Probeaufgaben oder Karteikarten, kein Nachlesen vorab.'} Planungshilfe von lernfunkenwelt.de`),
        'CATEGORIES:' + escapeText('Lernplan'),
        'TRANSP:OPAQUE');
      if (opt.alarm != null && opt.alarm >= 0) {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapeText(`${ART[b.art]}: ${b.thema}`), `TRIGGER:-PT${Math.round(opt.alarm)}M`, 'END:VALARM');
      }
      L.push('END:VEVENT');
    });
  }
  n++;
  L.push('BEGIN:VEVENT', `UID:${planId}-pruefung@lernfunkenwelt.de`, 'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + plan.pruefung.replace(/-/g, ''),
    'DTEND;VALUE=DATE:' + (() => { const d = new Date(plan.pruefung + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); })(),
    'SUMMARY:' + escapeText('Prüfung'), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  L.push('END:VCALENDAR');
  return { text: L.map(falte).join('\r\n') + '\r\n', ereignisse: n };
}

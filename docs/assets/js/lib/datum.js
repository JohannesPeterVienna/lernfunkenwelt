// Datumsrechnung auf ISO-Tagen (YYYY-MM-DD) in UTC – keine Sommerzeit-Sprünge.

export function istTag(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
}

export function plusTage(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function differenz(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** Wochentag 0 = Montag … 6 = Sonntag. */
export function wochentag(s) {
  return (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

export function heuteLokal(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export function kurz(s) {
  const [y, m, d] = s.split('-');
  return `${WT[wochentag(s)]} ${d}.${m}.${y}`;
}

/** ISO-Kalenderwoche für die Wochenansicht. */
export function kalenderwoche(s) {
  const d = new Date(s + 'T00:00:00Z');
  const tag = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - tag + 3);
  const erster = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - erster) / 86400000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
}

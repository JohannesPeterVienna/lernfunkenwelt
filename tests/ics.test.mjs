import test from 'node:test';
import assert from 'node:assert/strict';
import { erstelle } from '../docs/assets/js/lib/lernplan.js';
import { erzeugeIcs, falte, escapeText } from '../docs/assets/js/lib/ics.js';

const plan = erstelle({ start: '2026-11-02', pruefung: '2026-12-14', themen: [{ name: 'Recht, Steuern; Grundlagen', stufe: 'mittel' }, { name: 'Kostenrechnung – Übungen mit sehr langem Titel für die Zeilenfaltung', stufe: 'schwer' }], minuten: [60, 60, 0, 60, 0, 120, 90], puffer: 10 });
const { text, ereignisse } = erzeugeIcs(plan, { beginn: '18:30', alarm: 15, jetzt: new Date(Date.UTC(2026, 9, 31, 12, 0, 0)) });

test('CRLF-Zeilenenden ausschließlich', () => {
  assert.ok(text.endsWith('\r\n'));
  assert.equal(text.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(text.replace(/\r\n/g, '').includes('\r'), false);
});
test('Grundstruktur VCALENDAR mit VERSION und PRODID', () => {
  const l = text.split('\r\n');
  assert.equal(l[0], 'BEGIN:VCALENDAR'); assert.equal(l.at(-2), 'END:VCALENDAR');
  assert.ok(l.includes('VERSION:2.0'));
  assert.ok(l.some(x => x.startsWith('PRODID:')));
});
test('Jedes VEVENT hat eindeutige UID, DTSTAMP und DTSTART', () => {
  const ent = text.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1);
  assert.equal(ent.length, ereignisse);
  const uids = new Set();
  for (const e of ent) {
    const uid = e.match(/\r\nUID:([^\r]+)/)[1];
    assert.ok(!uids.has(uid)); uids.add(uid);
    assert.match(e, /\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/);
    assert.match(e, /\r\nDTSTART(;[^:]+)?:\d{8}/);
    assert.ok(e.includes('END:VEVENT'));
  }
  assert.ok(ereignisse > 10);
});
test('Zeilen höchstens 75 Oktette, Folgezeilen mit Leerzeichen', () => {
  for (const l of text.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.equal(falte('X'.repeat(80)).split('\r\n')[1][0], ' ');
});
test('Sonderzeichen werden maskiert', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  assert.ok(text.replace(/\r\n /g, '').includes(String.raw`Recht\, Steuern\; Grundlagen`));
});
test('VTIMEZONE und VALARM vorhanden, Prüfung ganztägig', () => {
  assert.ok(text.includes('BEGIN:VTIMEZONE') && text.includes('TZID:Europe/Vienna'));
  assert.ok(text.includes('TRIGGER:-PT15M'));
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261214') && text.includes('DTEND;VALUE=DATE:20261215'));
});

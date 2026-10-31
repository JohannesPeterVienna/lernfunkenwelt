import test from 'node:test';
import assert from 'node:assert/strict';
import { neueKarte, bewerte, faellige, zuCsv, ausCsv, ausSicherung, zuSicherung } from '../docs/assets/js/lib/karten.js';
import { AUFGABEN, runde, auswerten } from '../docs/assets/js/lib/rechtschreibung.js';

test('Fächer steigen, Fehler setzt zurück, Prüfung kappt', () => {
  let k = neueKarte('F', 'A', 'T', '2026-11-01');
  k = bewerte(k, true, '2026-11-01'); assert.equal(k.fach, 2); assert.equal(k.faellig, '2026-11-03');
  k = bewerte({ ...k, fach: 4 }, true, '2026-11-01'); assert.equal(k.fach, 5); assert.equal(k.faellig, '2026-11-17');
  const g = bewerte({ ...k, fach: 4 }, true, '2026-11-01', '2026-11-10'); assert.equal(g.faellig, '2026-11-09');
  k = bewerte(k, false, '2026-11-01'); assert.equal(k.fach, 1); assert.equal(k.faellig, '2026-11-02');
});
test('Fällige Karten nach Thema', () => {
  const ks = [neueKarte('a', 'b', 'X', '2026-11-01'), neueKarte('c', 'd', 'Y', '2026-11-05')];
  assert.equal(faellige(ks, '2026-11-02').length, 1);
  assert.equal(faellige(ks, '2026-11-06', 'Y').length, 1);
});
test('CSV hin und zurück mit Semikolon, Anführungszeichen und Zeilenumbruch', () => {
  const ks = [neueKarte('Was ist "AFBG"?', 'Gesetz; Aufstieg\nzweite Zeile', 'Förderung', '2026-11-01')];
  const back = ausCsv(zuCsv(ks), '2026-11-01');
  assert.equal(back.length, 1); assert.equal(back[0].vorne, 'Was ist "AFBG"?'); assert.equal(back[0].hinten, 'Gesetz; Aufstieg\nzweite Zeile');
  assert.equal(ausCsv('a\tb\tc\n', '2026-11-01')[0].thema, 'c');
});
test('Sicherung des alten Abruftrainers wird übernommen', () => {
  const r = ausSicherung({ version: 1, cards: [{ id: 'x', front: 'F', back: 'B', level: 2, due: '2026-11-04', reviews: 3 }] }, '2026-11-01');
  assert.equal(r.karten[0].fach, 3); assert.equal(r.karten[0].faellig, '2026-11-04');
  const eigene = ausSicherung(zuSicherung(r.karten, '2026-12-01'), '2026-11-01');
  assert.equal(eigene.pruefung, '2026-12-01');
  assert.throws(() => ausSicherung({ foo: 1 }, '2026-11-01'));
});
test('Rechtschreibung: eindeutige Lösungen, Runde filtert Fehler', () => {
  assert.ok(AUFGABEN.length >= 40);
  for (const a of AUFGABEN) { assert.ok(a.loesung < a.optionen.length); assert.equal(new Set(a.optionen).size, a.optionen.length); }
  const erg = { r1: false, r2: true };
  assert.deepEqual(runde(AUFGABEN, '', true, erg, 3).map(a => a.id), ['r1']);
  assert.equal(auswerten(AUFGABEN[0], AUFGABEN[0].loesung).richtig, true);
});

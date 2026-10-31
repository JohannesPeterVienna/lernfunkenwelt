import test from 'node:test';
import assert from 'node:assert/strict';
import { erstelle, verschiebe, abstandsAnteil, naechsterAbstand, wiederholungsTage, pruefeSicherung } from '../docs/assets/js/lib/lernplan.js';
import { differenz, plusTage, wochentag } from '../docs/assets/js/lib/datum.js';

const basis = { start: '2026-11-02', pruefung: '2027-01-25', themen: [{ name: 'A', stufe: 'leicht' }, { name: 'B', stufe: 'mittel' }, { name: 'C', stufe: 'schwer' }], minuten: [60, 60, 60, 60, 60, 120, 120], sperrtage: ['2026-12-24', '2026-12-25'], puffer: 20 };

test('Abstandsanteile treffen die Studienwerte', () => {
  assert.equal(abstandsAnteil(7), 0.43);
  assert.equal(abstandsAnteil(35), 0.23);
  assert.equal(abstandsAnteil(70), 0.17);
  assert.equal(abstandsAnteil(350), 0.08);
  assert.ok(abstandsAnteil(20) < 0.43 && abstandsAnteil(20) > 0.23);
  assert.equal(naechsterAbstand(70), 12);
  assert.equal(naechsterAbstand(1), 1);
});
test('Wiederholungsabstände werden zur Prüfung hin kürzer und enden vor der Abrufphase', () => {
  const t = wiederholungsTage(0, 84, 77);
  assert.ok(t.length >= 3);
  assert.ok(t.every(x => x < 77));
  const gaps = t.map((x, i) => x - (i ? t[i - 1] : 0));
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] <= gaps[i - 1]);
});
test('Plan passt, respektiert Kapazität, Sperrtage und Abrufwoche', () => {
  const p = erstelle(basis);
  assert.ok(p.ok); assert.ok(p.passt);
  for (const t of p.tage) {
    const sum = t.bloecke.reduce((s, b) => s + b.min, 0);
    assert.ok(sum <= t.kap, t.datum);
    if (basis.sperrtage.includes(t.datum)) assert.equal(t.bloecke.length, 0);
    if (t.datum >= p.abrufStart) assert.ok(t.bloecke.every(b => b.art !== 'neu'));
  }
  assert.equal(differenz(p.abrufStart, basis.pruefung), 7);
  for (const name of ['A', 'B', 'C']) {
    const arten = p.tage.flatMap(t => t.bloecke.filter(b => b.thema === name).map(b => b.art));
    assert.ok(arten.includes('neu') && arten.includes('wiederholung') && arten.includes('abruf'), name);
  }
  const neu = p.tage.flatMap(t => t.bloecke).filter(b => b.art === 'neu').reduce((s, b) => s + b.min, 0);
  assert.equal(neu, (3 + 6 + 10) * 60);
});
test('Puffer wird abgezogen', () => {
  const p = erstelle(basis);
  const mo = p.tage.find(t => wochentag(t.datum) === 0 && !t.gesperrt);
  assert.equal(mo.kap, 48);
});
test('Überlastung wird gemeldet', () => {
  const p = erstelle({ ...basis, pruefung: '2026-11-20', themen: Array.from({ length: 8 }, (_, i) => ({ name: 'T' + i, stufe: 'schwer' })) });
  assert.ok(p.ok); assert.equal(p.passt, false); assert.ok(p.fehlend > 0);
});
test('Ungültige Eingaben werden abgefangen', () => {
  assert.equal(erstelle({ ...basis, pruefung: '2026-11-03' }).ok, false);
  assert.equal(erstelle({ ...basis, themen: [] }).ok, false);
  assert.equal(erstelle({ ...basis, minuten: [0, 0, 0, 0, 0, 0, 0] }).ok, false);
  assert.equal(erstelle({ ...basis, start: '2026-02-30' }).ok, false);
});
test('Verpasste Blöcke werden verschoben, erledigte bleiben', () => {
  const p = erstelle(basis);
  p.tage[0].bloecke[0].erledigt = true;
  const heute = plusTage(basis.start, 5);
  const offenVorher = p.tage.filter(t => t.datum < heute).flatMap(t => t.bloecke).filter(b => !b.erledigt).length;
  const r = verschiebe(p, heute);
  assert.equal(r.verschoben + (r.nichtPlatziert ? 1 : 0) >= Math.min(1, offenVorher), true);
  assert.ok(r.plan.tage.filter(t => t.datum < heute).flatMap(t => t.bloecke).every(b => b.erledigt));
  assert.equal(r.plan.tage[0].bloecke.length, 1);
});
test('Sicherung wird geprüft', () => {
  const p = erstelle(basis);
  assert.ok(pruefeSicherung(JSON.parse(JSON.stringify(p))));
  assert.throws(() => pruefeSicherung({ version: 2 }));
});

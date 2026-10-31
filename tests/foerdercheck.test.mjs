import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pruefe, tagsatzStufe, bildungsurlaubAnspruch, istAktuell } from '../docs/assets/js/lib/foerdercheck.js';

const daten = JSON.parse(readFileSync(new URL('../docs/data/foerderungen.json', import.meta.url)));
const heute = '2026-10-31';
const finde = (r, id) => r.ergebnisse.find(e => e.id === id);
const basisAT = { land: 'AT', region: 'W', status: 'angestellt', monate: 24, art: 'kurs', wochenstunden: 20, dauerMonate: 6, kosten: 2000 };

test('Jeder Eintrag hat Quelle, Stand und Prüfdatum', () => {
  for (const e of daten.eintraege) {
    assert.match(e.quelle_url, /^https:\/\//, e.id);
    assert.match(e.stand, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.equal(e.geprueft_am, '2026-10-31', e.id);
  }
});

test('Ergebnis trägt immer den Hinweis auf die Förderstelle', () => {
  const r = pruefe(daten, basisAT, heute);
  assert.equal(r.hinweis, 'Orientierung, verbindlich entscheidet die Förderstelle.');
});

test('Weiterbildungsbeihilfe: 20 Std., 6 Monate, 24 Monate beschäftigt → passt', () => {
  assert.equal(finde(pruefe(daten, basisAT, heute), 'at-weiterbildungsbeihilfe').status, 'passt');
});
test('Weiterbildungsbeihilfe: 11 Monate beim Dienstgeber → passt nicht', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, monate: 11 }, heute), 'at-weiterbildungsbeihilfe').status, 'passt_nicht');
});
test('Weiterbildungsbeihilfe: 16 Std. nur ohne Kinderbetreuung ausreichend', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, wochenstunden: 16 }, heute), 'at-weiterbildungsbeihilfe').status, 'passt_nicht');
  assert.equal(finde(pruefe(daten, { ...basisAT, wochenstunden: 16, ohneBetreuung: true }, heute), 'at-weiterbildungsbeihilfe').status, 'passt');
});
test('Teilzeitbeihilfe: 12 Std. über 6 Monate passt, 3 Monate nicht', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, wochenstunden: 12 }, heute), 'at-weiterbildungsteilzeitbeihilfe').status, 'passt');
  assert.equal(finde(pruefe(daten, { ...basisAT, wochenstunden: 12, dauerMonate: 3 }, heute), 'at-weiterbildungsteilzeitbeihilfe').status, 'passt_nicht');
});
test('Tagsatz-Stufen 2026 laut AMS-Tabelle', () => {
  const e = daten.eintraege.find(x => x.id === 'at-weiterbildungsbeihilfe');
  assert.equal(tagsatzStufe(e, 1000).gesamt, 41.49);
  assert.equal(tagsatzStufe(e, 3465).dg, 8.12);
  assert.equal(tagsatzStufe(e, 3800).gesamt, 60.62);
  assert.equal(tagsatzStufe(e, 9000).gesamt, 69.77);
  assert.equal(tagsatzStufe(e, 400), null);
});
test('Fachkräftestipendium: Hochschulabschluss schließt aus', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, status: 'arbeitslos', hochschule: true }, heute), 'at-fachkraeftestipendium').status, 'passt_nicht');
});
test('waff umfangreich: 2.300 € netto → 40 %, 2.400 € Kosten → 960 €', () => {
  const r = finde(pruefe(daten, { ...basisAT, netto: 2300, kosten: 2400 }, heute), 'at-wien-bildungskonto-umfangreich');
  assert.equal(r.status, 'passt'); assert.equal(r.betrag, 960);
});
test('waff umfangreich: über 2.800 € netto → passt nicht', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, netto: 2900 }, heute), 'at-wien-bildungskonto-umfangreich').status, 'passt_nicht');
});
test('waff für alle: Höchstbetrag 500 €', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, kosten: 3000 }, heute), 'at-wien-bildungskonto-alle').betrag, 500);
});
test('Wien-Programme scheiden außerhalb Wiens aus', () => {
  assert.equal(finde(pruefe(daten, { ...basisAT, region: 'T' }, heute), 'at-wien-bildungskonto-alle').status, 'passt_nicht');
});
test('Oö. Bildungskonto: Meister 40 % bis 2.400 €, Kurse unter 150 € nicht', () => {
  const r = finde(pruefe(daten, { ...basisAT, region: 'OOE', art: 'meister', kosten: 4900 }, heute), 'at-ooe-bildungskonto');
  assert.equal(r.betrag, 1960);
  assert.equal(finde(pruefe(daten, { ...basisAT, region: 'OOE', art: 'meister', kosten: 9000 }, heute), 'at-ooe-bildungskonto').betrag, 2400);
  assert.equal(finde(pruefe(daten, { ...basisAT, region: 'OOE', kosten: 120 }, heute), 'at-ooe-bildungskonto').status, 'passt_nicht');
});
test('Abgelaufene Einträge zeigen „wird geprüft“', () => {
  const r = pruefe(daten, basisAT, '2027-01-02');
  assert.equal(finde(r, 'at-weiterbildungsbeihilfe').status, 'wird_geprueft');
  assert.equal(istAktuell(daten.eintraege.find(e => e.id === 'at-ooe-bildungskonto'), '2027-01-02'), true);
});

const basisDE = { land: 'DE', region: 'NW', status: 'angestellt', monate: 24, art: 'meister', gesamtstunden: 1100, dauerMonate: 24, kosten: 9800, betrieb: 30, arbeitstage: 5 };
test('Aufstiegs-BAföG: 9.800 € → 4.900 € Zuschuss, unter 400 Std. ausgeschlossen', () => {
  const r = finde(pruefe(daten, basisDE, heute), 'de-aufstiegs-bafoeg');
  assert.equal(r.status, 'passt'); assert.equal(r.betrag, 4900);
  assert.equal(finde(pruefe(daten, { ...basisDE, gesamtstunden: 300 }, heute), 'de-aufstiegs-bafoeg').status, 'passt_nicht');
  assert.equal(finde(pruefe(daten, { ...basisDE, kosten: 20000 }, heute), 'de-aufstiegs-bafoeg').betrag, 7500);
});
test('Bildungsurlaub: NRW > 10 Beschäftigte passt, 8 Beschäftigte nicht; Bayern ohne Gesetz', () => {
  assert.equal(finde(pruefe(daten, basisDE, heute), 'de-bildungsurlaub').status, 'passt');
  assert.equal(finde(pruefe(daten, { ...basisDE, betrieb: 8 }, heute), 'de-bildungsurlaub').status, 'passt_nicht');
  assert.equal(finde(pruefe(daten, { ...basisDE, region: 'BY' }, heute), 'de-bildungsurlaub').status, 'passt_nicht');
});
test('Bildungsurlaub Sachsen: vor 2027 nein, Wartezeit mehr als 6 Monate', () => {
  assert.equal(finde(pruefe(daten, { ...basisDE, region: 'SN', kursbeginn: '2026-11-15' }, heute), 'de-bildungsurlaub').status, 'passt_nicht');
  assert.equal(finde(pruefe(daten, { ...basisDE, region: 'SN', kursbeginn: '2027-03-01', monate: 6 }, heute), 'de-bildungsurlaub').status, 'passt_nicht');
  assert.equal(finde(pruefe(daten, { ...basisDE, region: 'SN', kursbeginn: '2027-03-01', monate: 7 }, heute), 'de-bildungsurlaub').status, 'passt');
});
test('Bildungsurlaub anteilig bei 4 Arbeitstagen', () => {
  const l = daten.eintraege.find(e => e.id === 'de-bildungsurlaub').laender;
  assert.equal(bildungsurlaubAnspruch(l.HE, 4), 4);
  assert.equal(bildungsurlaubAnspruch(l.RP, 3), 6);
  assert.equal(bildungsurlaubAnspruch(l.SN, 5), 3);
});
test('§ 87a nur bei Umschulung', () => {
  assert.equal(finde(pruefe(daten, basisDE, heute), 'de-87a-praemien').status, 'passt_nicht');
  assert.equal(finde(pruefe(daten, { ...basisDE, art: 'umschulung', status: 'arbeitslos' }, heute), 'de-87a-praemien').status, 'pruefen');
});
test('§ 82: bis 120 Stunden ausgeschlossen', () => {
  assert.equal(finde(pruefe(daten, { ...basisDE, gesamtstunden: 120 }, heute), 'de-82-beschaeftigte').status, 'passt_nicht');
});

test('Bildungsurlaub: Wartezeiten BW 12 Monate, HH/NI/ST 6 Monate', () => {
  const bu = (region, monate) => finde(pruefe(daten, { land: 'DE', region, status: 'angestellt', monate, betrieb: 50, arbeitstage: 5 }, heute), 'de-bildungsurlaub').status;
  assert.equal(bu('BW', 8), 'passt_nicht');
  assert.equal(bu('BW', 13), 'passt');
  for (const r of ['HH', 'NI', 'ST']) { assert.equal(bu(r, 3), 'passt_nicht', r); assert.equal(bu(r, 7), 'passt', r); }
});
test('Bildungsurlaub: Thüringen und Sachsen-Anhalt unter 5 Beschäftigten ohne Anspruch', () => {
  for (const r of ['TH', 'ST']) assert.equal(finde(pruefe(daten, { land: 'DE', region: r, status: 'angestellt', monate: 24, betrieb: 3, arbeitstage: 5 }, heute), 'de-bildungsurlaub').status, 'passt_nicht', r);
});
test('Leere Arbeitstage gelten als Fünf-Tage-Woche', () => {
  const e = finde(pruefe(daten, { land: 'DE', region: 'HE', status: 'angestellt', monate: 24, betrieb: 50, arbeitstage: '' }, heute), 'de-bildungsurlaub');
  assert.equal(e.tage, 5);
});

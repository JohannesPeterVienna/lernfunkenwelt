// Förder-Check: reine Prüflogik ohne DOM, damit sie in Node getestet werden kann.
// Ergebnis ist immer eine Orientierung – verbindlich entscheidet die Förderstelle.

export const STATUS = Object.freeze({
  PASST: 'passt',
  PRUEFEN: 'pruefen',
  NEIN: 'passt_nicht',
  WIRD_GEPRUEFT: 'wird_geprueft'
});

export const STATUS_TEXT = {
  passt: 'passt voraussichtlich',
  pruefen: 'genauer prüfen',
  passt_nicht: 'passt nach diesen Angaben nicht',
  wird_geprueft: 'Werte werden gerade geprüft'
};

const eur = n => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** ISO-Datum (YYYY-MM-DD) aus Date in lokaler Zeit. */
export function isoDay(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

/** Ist ein Datensatz am Stichtag gültig? Abgelaufene Einträge werden nicht bewertet. */
export function istAktuell(eintrag, heute) {
  if (eintrag.gueltig_bis && heute > eintrag.gueltig_bis) return false;
  return true;
}

function out(e, status, grund, schritt, extra = {}) {
  return {
    id: e.id, name: e.name, traeger: e.traeger, status, grund, schritt,
    quelle_url: e.quelle_url, stand: e.stand, geprueft_am: e.geprueft_am, ...extra
  };
}

/** Normalisiert Eingaben, setzt sinnvolle Standardwerte und begrenzt Zahlen. */
export function normalisiere(raw) {
  const num = (v, d = 0) => { if (v == null || String(v).trim() === '') return d; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : d; };
  return {
    land: raw.land === 'DE' ? 'DE' : 'AT',
    region: String(raw.region || ''),
    status: ['angestellt', 'arbeitslos', 'selbststaendig', 'karenz'].includes(raw.status) ? raw.status : 'angestellt',
    monate: num(raw.monate),
    monateBekannt: raw.monate != null && String(raw.monate).trim() !== '',
    art: ['kurs', 'studium', 'meister', 'lehrabschluss', 'sprache', 'digital', 'matura', 'umschulung'].includes(raw.art) ? raw.art : 'kurs',
    wochenstunden: num(raw.wochenstunden),
    dauerMonate: num(raw.dauerMonate),
    gesamtstunden: num(raw.gesamtstunden),
    kosten: num(raw.kosten),
    netto: raw.netto === '' || raw.netto == null ? null : num(raw.netto),
    brutto: raw.brutto === '' || raw.brutto == null ? null : num(raw.brutto),
    ohneBetreuung: !!raw.ohneBetreuung,
    master: !!raw.master,
    hochschule: !!raw.hochschule,
    beschaeftigungsJahre15: raw.beschaeftigungsJahre15 === '' || raw.beschaeftigungsJahre15 == null ? null : num(raw.beschaeftigungsJahre15),
    betrieb: num(raw.betrieb),
    ab45: !!raw.ab45,
    arbeitstage: Math.min(7, Math.max(1, num(raw.arbeitstage, 5))),
    kursbeginn: /^\d{4}-\d{2}-\d{2}$/.test(raw.kursbeginn || '') ? raw.kursbeginn : null,
    berufsabschlussVorJahren: raw.berufsabschlussVorJahren === '' || raw.berufsabschlussVorJahren == null ? null : num(raw.berufsabschlussVorJahren)
  };
}

// ---------- Österreich ----------

function weiterbildungsbeihilfe(e, x) {
  const w = e.werte;
  if (x.status !== 'angestellt' && x.status !== 'karenz') return out(e, STATUS.NEIN, 'Die Beihilfe setzt ein aufrechtes Dienstverhältnis voraus, für das Sie mit dem Dienstgeber eine Weiterbildungszeit vereinbaren.', 'Bei Arbeitslosigkeit ist die AMS-Beratung und das Fachkräftestipendium die passendere Spur.');
  const minMonate = x.master ? w.beschaeftigung_monate_master : w.beschaeftigung_monate;
  const schwelle = x.ohneBetreuung ? w.wochenstunden_min_ohne_betreuung : w.wochenstunden_min;
  const probleme = [];
  if (x.monate < w.beschaeftigung_monate) probleme.push(`Sie sind ${x.monate} Monate beim aktuellen Dienstgeber; verlangt sind mindestens ${w.beschaeftigung_monate} Monate durchgehend.`);
  if (x.master && x.monate >= w.beschaeftigung_monate) probleme.push(`Mit Master- oder Diplomabschluss verlangt das AMS insgesamt ${minMonate / 12} Jahre vollversicherte Beschäftigung – bitte selbst nachrechnen.`);
  if (x.wochenstunden && x.wochenstunden < schwelle) probleme.push(`Der Kurs hat ${x.wochenstunden} Wochenstunden; die Schwelle liegt bei ${schwelle}.`);
  if (x.dauerMonate && x.dauerMonate < w.dauer_monate_min) probleme.push(`Die Ausbildung dauert ${x.dauerMonate} Monate; mindestens ${w.dauer_monate_min} sind nötig.`);
  const hart = (x.monate < w.beschaeftigung_monate) || (x.wochenstunden && x.wochenstunden < schwelle) || (x.dauerMonate && x.dauerMonate < w.dauer_monate_min);
  let zusatz = '';
  if (x.brutto != null) {
    const stufe = tagsatzStufe(e, x.brutto);
    if (stufe) zusatz = ` Nach der AMS-Pauschalsatztabelle 2026 läge der Tagsatz bei ${eur(stufe.gesamt)} pro Tag${stufe.dg ? ` (davon ${eur(stufe.dg)} vom Dienstgeber)` : ''}.`;
    if (x.brutto < w.halbe_hbgl_eur) zusatz += ' Unter ' + eur(w.halbe_hbgl_eur) + ' brutto ist eine Bildungsberatung im BerufsInfoZentrum Pflicht.';
  }
  if (hart) return out(e, STATUS.NEIN, probleme.join(' '), 'Prüfen Sie die Weiterbildungsteilzeitbeihilfe oder einen intensiveren Kurs.');
  if (!x.wochenstunden || !x.dauerMonate || probleme.length) return out(e, STATUS.PRUEFEN, (probleme.join(' ') || 'Wochenstunden oder Dauer fehlen, die Schwellen lassen sich noch nicht prüfen.') + zusatz, 'Vereinbarung mit dem Dienstgeber abschließen, dann Antrag über MeinAMS – frühestens 3 Monate vor Beginn.');
  return out(e, STATUS.PASST, `${x.wochenstunden} Wochenstunden und ${x.dauerMonate} Monate erfüllen die Schwellen (${schwelle} Std., ${w.dauer_monate_min} Monate); die Beschäftigungsdauer passt.` + zusatz, 'Vereinbarung „Weiterbildungszeit“ mit dem Dienstgeber abschließen, dann Antrag über MeinAMS – frühestens 3 Monate vor Beginn. Kein Rechtsanspruch, das Budget ist begrenzt.');
}

/** Tagsatz-Stufe nach Bruttoeinkommen (Allgemeine Beitragsgrundlage). */
export function tagsatzStufe(e, brutto) {
  const st = e.stufen_2026 || [];
  return st.find(s => brutto >= s.von && (s.bis == null || brutto <= s.bis)) || null;
}

function weiterbildungsteilzeit(e, x) {
  const w = e.werte;
  if (x.status !== 'angestellt' && x.status !== 'karenz') return out(e, STATUS.NEIN, 'Die Teilzeitbeihilfe setzt voraus, dass Sie im bestehenden Dienstverhältnis Ihre Arbeitszeit reduzieren.', 'Für Arbeitsuchende ist die Beratung beim AMS der erste Schritt.');
  const schwelle = x.ohneBetreuung ? w.wochenstunden_min_ohne_betreuung : w.wochenstunden_min;
  const p = [];
  if (x.monate < w.beschaeftigung_monate) p.push(`Verlangt sind ${w.beschaeftigung_monate} Monate durchgehend beim aktuellen Dienstgeber (angegeben: ${x.monate}).`);
  if (x.wochenstunden && x.wochenstunden < schwelle) p.push(`Der Kurs hat ${x.wochenstunden} Wochenstunden; nötig sind mindestens ${schwelle}.`);
  if (x.dauerMonate && x.dauerMonate < w.dauer_monate_min) p.push(`Die Mindestdauer beträgt ${w.dauer_monate_min} Monate (angegeben: ${x.dauerMonate}).`);
  if (p.length) return out(e, STATUS.NEIN, p.join(' '), 'Kurs mit mehr Stunden oder längerer Laufzeit wählen oder eine Landesförderung prüfen.');
  if (!x.wochenstunden || !x.dauerMonate) return out(e, STATUS.PRUEFEN, `Die Schwellen sind ${schwelle} Wochenstunden und ${w.dauer_monate_min} Monate; mindestens eine Angabe fehlt noch.`, 'Kursplan besorgen und Stunden je Woche nachrechnen.');
  return out(e, STATUS.PASST, `${x.wochenstunden} Wochenstunden über ${x.dauerMonate} Monate erfüllen die Schwellen. Die Arbeitszeit muss um ${w.reduktion_min_prozent} bis ${w.reduktion_max_prozent} % sinken.`, 'Teilzeitvereinbarung mit dem Dienstgeber schließen, dann Antrag über MeinAMS.');
}

function fachkraeftestipendium(e, x) {
  const w = e.werte;
  if (x.hochschule) return out(e, STATUS.NEIN, 'Mit einem Abschluss einer Universität, Fachhochschule oder Pädagogischen Hochschule ist das Stipendium ausgeschlossen.', 'Weiterbildungszeit oder Landesförderungen prüfen.');
  if (x.art === 'studium') return out(e, STATUS.NEIN, 'Universitäts- und FH-Studien sind nicht förderbar.', 'Für ein Studium neben dem Beruf ist die Weiterbildungsteilzeit der passendere Weg.');
  const p = [];
  if (x.beschaeftigungsJahre15 != null && x.beschaeftigungsJahre15 < w.beschaeftigung_jahre) return out(e, STATUS.NEIN, `Verlangt sind mindestens ${w.beschaeftigung_jahre} Jahre (${w.beschaeftigung_wochen} Wochen) arbeitslosenversicherte Beschäftigung in den letzten ${w.betrachtungszeitraum_jahre} Jahren.`, 'Versicherungsdatenauszug bei der Sozialversicherung anfordern und nachzählen.');
  if (x.wochenstunden && x.wochenstunden < w.wochenstunden_min) p.push(`Der Kurs hat ${x.wochenstunden} Wochenstunden; nötig sind ${w.wochenstunden_min}.`);
  if (x.dauerMonate && x.dauerMonate < w.dauer_monate_min) p.push(`Die Ausbildung muss mindestens ${w.dauer_monate_min} Monate dauern.`);
  if (p.length) return out(e, STATUS.NEIN, p.join(' '), 'Vollzeitnahe Ausbildung aus der AMS-Liste wählen.');
  if (x.status === 'angestellt') return out(e, STATUS.PRUEFEN, 'Das Stipendium gibt es für Arbeitslose, für wegen der Ausbildung Karenzierte und für Selbstständige mit ruhendem Gewerbe. Angestellte müssten sich dafür karenzieren lassen.', 'Früh einen Termin beim AMS vereinbaren; die Genehmigung ist frühestens 3 Monate vor Beginn möglich.');
  return out(e, STATUS.PRUEFEN, `Grundvoraussetzungen sind plausibel. Entscheidend ist, ob Ihre Ausbildung auf der AMS-Liste steht (u. a. MINT, Gesundheit, Soziales). Mindesthöhe 2026: ${eur(w.tagsatz_eur)} pro Tag.`, 'Ausbildung mit der aktuellen AMS-Liste abgleichen und Beratungstermin vereinbaren – Genehmigung frühestens 3 Monate vor Beginn.');
}

function staffelProzent(staffel, netto) {
  const s = staffel.find(z => netto <= z.netto_bis);
  return s ? s.prozent : null;
}

function wien(e, x) {
  if (x.region !== 'W') return out(e, STATUS.NEIN, 'Voraussetzung ist ein Hauptwohnsitz in Wien.', 'Förderungen Ihres Bundeslandes prüfen (AK, Land).');
  const w = e.werte;
  if (x.kosten && w.kurskosten_min_eur && x.kosten < w.kurskosten_min_eur) return out(e, STATUS.NEIN, `Kurskosten von ${eur(x.kosten)} liegen unter der Untergrenze von ${eur(w.kurskosten_min_eur)}.`, 'Kurse bündeln oder einen umfangreicheren Kurs wählen.');
  if (x.status === 'selbststaendig') return out(e, STATUS.PRUEFEN, 'Gewerblich Selbstständige sind ausgeschlossen; nur Neue Selbstständige nach GSVG sind förderbar.', 'Versicherungsstatus klären.');
  if (e.id === 'at-wien-bildungskonto-alle') {
    if (x.status === 'arbeitslos') return out(e, STATUS.PRUEFEN, 'Arbeitslose sind förderbar, wenn sie beim AMS Wien vorgemerkt sind.', 'Antrag spätestens 3 Monate nach Abschluss.', { betrag: x.kosten ? Math.min(x.kosten * w.prozent / 100, w.max_eur) : null });
    const b = x.kosten ? Math.min(x.kosten * w.prozent / 100, w.max_eur) : null;
    return out(e, STATUS.PASST, `Ohne Einkommensgrenze: ${w.prozent} % der Kurs- und Prüfungskosten, höchstens ${eur(w.max_eur)}${b != null ? ` – bei Ihren Kosten rechnerisch ${eur(b)}` : ''}.`, 'Anerkannten Bildungsträger wählen, Antrag spätestens 3 Monate nach erfolgreichem Abschluss.', { betrag: b });
  }
  if (e.id === 'at-wien-digi-winner') {
    if (x.art !== 'digital') return out(e, STATUS.NEIN, 'Gefördert werden nur berufliche Kurse zu digitalen Kompetenzen.', 'Für andere Themen: Bildungskonto prüfen.');
    if (x.netto != null && x.netto > w.netto_max_eur) return out(e, STATUS.NEIN, `Die Einkommensgrenze liegt bei ${eur(w.netto_max_eur)} netto im Monat.`, 'Bildungskonto für Digitalisierung prüfen (Grenze 2.800 € netto).');
    return out(e, x.netto == null ? STATUS.PRUEFEN : STATUS.PASST, `AK-Wien-Mitgliedschaft vorausgesetzt: ${w.prozent_min}–${w.prozent_max} % der Kurskosten je nach Einkommen, höchstens ${eur(w.max_eur)} bei Arbeitsort Wien.`, 'Online beantragen – vor Kursbeginn oder spätestens 4 Wochen danach.');
  }
  if (e.id === 'at-wien-chancen-scheck') {
    if (x.status !== 'angestellt') return out(e, STATUS.PRUEFEN, 'Der Chancen-Scheck richtet sich an Beschäftigte mit Arbeitsplatz in Wien.', 'Beim waff-Beratungszentrum nachfragen.');
    return out(e, STATUS.PRUEFEN, 'Gilt für Beschäftigte mit höchstens Pflichtschulabschluss oder für Personen, die unter ihrer Qualifikation als Hilfskraft arbeiten. 90 % der Kosten, je nach Ziel bis 5.000 € oder 3.000 €.', 'Persönlich vor Kursbeginn beim waff beantragen.');
  }
  // Varianten mit Einkommensstaffel
  if (x.status === 'karenz') return out(e, STATUS.NEIN, 'Personen in Elternkarenz verweist der waff auf das Bildungskonto für alle.', 'Bildungskonto für alle nutzen.');
  if (x.status === 'arbeitslos') return out(e, STATUS.NEIN, 'Diese Variante setzt ein Beschäftigungsverhältnis zu Kursbeginn voraus.', 'Bildungskonto für alle oder AMS prüfen.');
  if (e.id === 'at-wien-bildungskonto-hoehere' && !['meister', 'matura', 'lehrabschluss'].includes(x.art)) return out(e, STATUS.NEIN, 'Diese Variante gilt für Meister-, Werkmeister- und Befähigungsprüfungen, Berufsreifeprüfung, Matura oder einen zweiten Lehrabschluss.', 'Passende Bildungskonto-Variante wählen.');
  if (e.id === 'at-wien-bildungskonto-digital' && x.art !== 'digital') return out(e, STATUS.NEIN, 'Nur Kurse zu Digitalisierung oder Klimaschutz.', 'Andere Variante prüfen.');
  if (x.netto == null) return out(e, STATUS.PRUEFEN, `Einkommensabhängig: 50/40/30 % bis 2.100/2.500/2.800 € netto, höchstens ${eur(w.max_eur)}.`, 'Netto-Monatseinkommen eintragen oder Lohnzettel bereitlegen.');
  const pr = staffelProzent(w.staffel, x.netto);
  if (pr == null) return out(e, STATUS.NEIN, `Ihr Netto-Einkommen liegt über ${eur(2800)}; die Variante ist ausgeschlossen.`, 'Bildungskonto für alle (ohne Einkommensgrenze) nutzen.');
  const b = x.kosten ? Math.min(x.kosten * pr / 100, w.max_eur) : null;
  return out(e, STATUS.PASST, `Bei ${eur(x.netto)} netto gelten ${pr} %, höchstens ${eur(w.max_eur)}${b != null ? ` – rechnerisch ${eur(b)}` : ''}.`, 'Antrag vor Kursbeginn oder spätestens 4 Wochen danach; Auszahlung nach Kursende.', { betrag: b });
}

function ooe(e, x) {
  const w = e.werte;
  if (x.region !== 'OOE') return out(e, STATUS.NEIN, 'Voraussetzung ist ein Hauptwohnsitz in Oberösterreich zu Kursbeginn.', 'Förderungen Ihres Bundeslandes prüfen.');
  if (x.art === 'studium') return out(e, STATUS.NEIN, 'Studien und Lehrgänge mit akademischem Grad sind ausgeschlossen.', 'Weiterbildungsteilzeit prüfen.');
  if (x.kosten && x.kosten < w.kurskosten_min_eur) return out(e, STATUS.NEIN, `Kurskosten unter ${eur(w.kurskosten_min_eur)} werden nicht gefördert.`, '');
  if (x.status === 'arbeitslos' && x.monate === 0) return out(e, STATUS.PRUEFEN, 'Arbeitslosengeld- oder Notstandshilfebeziehende sind förderbar, Arbeitsuchende ohne früheren Arbeitnehmerstatus nicht.', 'Status mit dem Land OÖ klären.');
  if (x.hochschule && x.brutto != null && x.brutto > w.akademiker_brutto_max_eur) return out(e, STATUS.NEIN, `Mit akademischem Abschluss gilt eine Grenze von ${eur(w.akademiker_brutto_max_eur)} brutto im Monat.`, '');
  const meister = x.art === 'meister';
  const sprache = x.art === 'sprache';
  const pr = meister ? w.prozent_meister : sprache ? w.prozent_sprache : w.prozent;
  const max = meister ? w.max_eur_meister : sprache ? w.max_eur_sprache : w.max_eur;
  const b = x.kosten ? Math.min(x.kosten * pr / 100, max) : null;
  const sprach = sprache ? ` Gefördert werden nur berufsspezifische Sprachkurse und Deutsch-Integrationskurse; für beide gilt der Höchstbetrag von ${eur(w.max_eur_sprache)}. Nicht berufsspezifische Sprachkurse sind ausgeschlossen.` : '';
  return out(e, x.art === 'sprache' ? STATUS.PRUEFEN : STATUS.PASST, `${pr} % der Kurskosten, höchstens ${eur(max)} im Zeitraum 2023–2028${b != null ? ` – rechnerisch ${eur(b)}` : ''}. Prüfungsgebühren zählen nicht dazu.${sprach}`, 'Kurs bei zertifiziertem Anbieter belegen, 75 % Anwesenheit nachweisen, Antrag bis 6 Monate nach Kursende.', { betrag: b });
}

// ---------- Deutschland ----------

/** Bildungsurlaub: Anspruch nach Land, Arbeitstagen und Betriebsgröße. */
export function bildungsurlaubAnspruch(land, arbeitstage = 5) {
  if (!land || !land.tage) return 0;
  // Sachsen: nur Verringerung unter fünf Arbeitstagen, keine Erhöhung (§ 2 Abs. 2 SächsQZG)
  const tage = land.nur_verringern ? Math.min(arbeitstage, 5) : arbeitstage;
  const roh = land.tage * tage / 5;
  // Berlin: Bruchteile werden zugunsten der Beschäftigten aufgerundet (§ 2 Abs. 2 BiZeitG)
  if (land.rundung === 'auf') return Math.ceil(roh - 1e-9);
  return Math.round(roh * 10) / 10;
}

/** Niedersachsen u. a.: Nachfolgeregelung ab Stichtag einblenden. */
function landZumKurs(l, kursbeginn) {
  if (l.nachfolger && kursbeginn && kursbeginn >= l.nachfolger.gueltig_ab) return { ...l, ...l.nachfolger, nachfolger: null, nachfolgerAktiv: true };
  return l;
}

function bildungsurlaub(e, x) {
  const l0 = e.laender[x.region];
  if (!l0) return out(e, STATUS.PRUEFEN, 'Bitte Bundesland wählen.', '');
  const l = landZumKurs(l0, x.kursbeginn);
  const ex = { quelle_url: l.quelle_url || e.quelle_url, stand: l.stand || e.stand };
  const name = `${e.name} – ${l.name}`;
  if (!l.gesetz) return { ...out(e, STATUS.NEIN, 'Bayern hat kein Gesetz über Bildungsurlaub. Freistellung gibt es nur über Tarifvertrag, Betriebsvereinbarung oder Absprache.', 'Tarifvertrag und Arbeitsvertrag prüfen, mit dem Arbeitgeber sprechen.'), ...ex, name };
  if (x.status !== 'angestellt') return { ...out(e, STATUS.NEIN, 'Bildungsurlaub ist eine Freistellung von der Arbeit; er setzt ein Beschäftigungsverhältnis voraus.', ''), ...ex, name };
  if (l.gueltig_ab && x.kursbeginn && x.kursbeginn < l.gueltig_ab) return { ...out(e, STATUS.NEIN, `Das ${l.gesetz} gilt erst ab ${l.gueltig_ab.split('-').reverse().join('.')}.`, 'Kurs ab 2027 planen und 12 Wochen vorher beantragen.'), ...ex, name };
  const tage = bildungsurlaubAnspruch(l, x.arbeitstage);
  const zeitraum = l.jahre === 2 ? 'in zwei Jahren' : 'pro Kalenderjahr';
  const teile = [`${l.gesetz}: ${tage} Arbeitstage ${zeitraum} bei ${x.arbeitstage} Arbeitstagen pro Woche.`];
  let st = STATUS.PASST;
  const warte = `${l.wartezeit_mehr_als ? 'mehr als ' : ''}${l.wartezeit_monate} Monaten`;
  if (!l.wartezeit_monate) { st = STATUS.PRUEFEN; teile.push('Die Wartezeit ist hier nicht hinterlegt; bitte im Landesgesetz nachsehen.'); }
  else if (!x.monateBekannt) { st = STATUS.PRUEFEN; teile.push(`Der Anspruch entsteht erst nach ${warte} Beschäftigung; bitte die Beschäftigungsdauer angeben.`); }
  else if (x.monate < l.wartezeit_monate + (l.wartezeit_mehr_als ? 0.01 : 0)) {
    st = l.wartezeit_anschluss ? STATUS.PRUEFEN : STATUS.NEIN;
    teile.push(`Der Anspruch entsteht erst nach ${warte} Beschäftigung.${l.wartezeit_anschluss ? ' ' + l.wartezeit_anschluss : ''}`);
  }
  if (x.betrieb && l.klein_ausschluss_unter && x.betrieb < l.klein_ausschluss_unter) { st = STATUS.NEIN; teile.push(l.kleinbetrieb); }
  else if (l.kleinbetrieb && (!x.betrieb || (l.klein_pruefen_bis && x.betrieb <= l.klein_pruefen_bis))) { if (st === STATUS.PASST) st = STATUS.PRUEFEN; teile.push(l.kleinbetrieb); }
  if (l.nachfolger && !x.kursbeginn) teile.push(l.nachfolger.hinweis);
  else if (l.nachfolgerAktiv && l.hinweis) teile.push(l.hinweis);
  if (l.gueltig_ab && !x.kursbeginn && st === STATUS.PASST) { st = STATUS.PRUEFEN; teile.push(`Das Gesetz gilt ab ${l.gueltig_ab.split('-').reverse().join('.')}; vorher besteht kein Anspruch.`); }
  if (x.art === 'sprache') { if (st === STATUS.PASST) st = STATUS.PRUEFEN; teile.push('Sprachkurse zählen nur, wenn die Veranstaltung im Land anerkannt ist.'); }
  return { ...out(e, st, teile.join(' '), `Nur anerkannte Veranstaltungen; Antrag beim Arbeitgeber spätestens ${l.frist_wochen} Wochen vor Beginn.`), ...ex, name, tage };
}

function aufstiegsBafoeg(e, x) {
  const w = e.werte;
  if (x.art !== 'meister') return out(e, STATUS.NEIN, 'Gefördert wird die Vorbereitung auf Fortbildungsabschlüsse wie Meister, Fachwirt, Techniker oder Erzieher (über 700 Abschlüsse).', 'Wenn Ihr Ziel ein solcher Abschluss ist, „Meister/Fachwirt“ wählen.');
  const p = [];
  const ausnahme53b = x.gesamtstunden && x.gesamtstunden >= w.mindest_unterrichtsstunden_53b && x.gesamtstunden < w.mindest_unterrichtsstunden;
  if (x.gesamtstunden && x.gesamtstunden < w.mindest_unterrichtsstunden_53b) p.push(`Der Lehrgang muss mindestens ${w.mindest_unterrichtsstunden} Unterrichtsstunden umfassen, in der Ausnahme nach § 2 Abs. 3 Satz 2 AFBG mindestens ${w.mindest_unterrichtsstunden_53b} (angegeben: ${x.gesamtstunden}).`);
  if (x.dauerMonate && x.dauerMonate > w.teilzeit_monate_max) p.push(`Teilzeitlehrgänge müssen innerhalb von ${w.teilzeit_monate_max} Monaten abgeschlossen sein.`);
  else if (ausnahme53b && x.dauerMonate && x.dauerMonate > w.teilzeit_monate_max_53b) p.push(`Lehrgänge mit ${w.mindest_unterrichtsstunden_53b} bis ${w.mindest_unterrichtsstunden - 1} Unterrichtsstunden müssen innerhalb von ${w.teilzeit_monate_max_53b} Monaten abgeschlossen sein.`);
  if (p.length) return out(e, STATUS.NEIN, p.join(' '), 'Lehrgangsanbieter nach Stundenzahl und Laufzeit fragen.');
  if (ausnahme53b) return out(e, STATUS.PRUEFEN, `Regulär sind ${w.mindest_unterrichtsstunden} Unterrichtsstunden nötig. Ab ${w.mindest_unterrichtsstunden_53b} Stunden ist ein Lehrgang nur förderfähig, wenn er in Teilzeit stattfindet, innerhalb von ${w.teilzeit_monate_max_53b} Monaten endet und auf einen Abschluss nach § 53b BBiG bzw. § 42b HwO (oder einen gleichwertigen) vorbereitet (§ 2 Abs. 3 Satz 2 AFBG).`, 'Beim Anbieter klären, ob der Abschluss unter § 53b BBiG oder § 42b HwO fällt und der Lehrgang in Teilzeit läuft.');
  const zuschuss = x.kosten ? Math.min(x.kosten, w.gebuehren_max_eur) * w.zuschuss_prozent / 100 : null;
  return out(e, x.gesamtstunden ? STATUS.PASST : STATUS.PRUEFEN, `Keine Altersgrenze. Lehrgangs- und Prüfungsgebühren bis ${eur(w.gebuehren_max_eur)}, davon ${w.zuschuss_prozent} % Zuschuss${zuschuss != null ? ` – bei Ihren Kosten ${eur(zuschuss)}` : ''}; der Rest als KfW-Darlehen, von dem nach bestandener Prüfung ${w.erlass_bestanden_prozent} % erlassen werden.`, 'Antrag bei der zuständigen Stelle Ihres Landes oder über „AFBG Digital“ – möglichst vor Lehrgangsbeginn.', { betrag: zuschuss });
}

function sgb82(e, x) {
  const w = e.werte;
  if (x.status !== 'angestellt') return out(e, STATUS.NEIN, '§ 82 SGB III fördert beschäftigte Arbeitnehmerinnen und Arbeitnehmer.', 'Bei Arbeitslosigkeit: Bildungsgutschein nach § 81 SGB III.');
  const p = [];
  if (x.gesamtstunden && x.gesamtstunden <= w.stunden_mehr_als) p.push(`Die Maßnahme muss mehr als ${w.stunden_mehr_als} Stunden umfassen.`);
  if (x.berufsabschlussVorJahren != null && x.berufsabschlussVorJahren < w.abschluss_vor_jahren) p.push(`Der letzte Berufsabschluss liegt in der Regel mindestens ${w.abschluss_vor_jahren} Jahre zurück.`);
  if (p.length) return out(e, STATUS.NEIN, p.join(' '), '');
  let ag = '';
  if (x.betrieb) {
    const a = w.ag_anteil.find(s => s.bis_unter == null || x.betrieb < s.bis_unter);
    const z = w.entgeltzuschuss.find(s => s.bis_unter == null || x.betrieb < s.bis_unter);
    const frei = x.ab45 && x.betrieb < 500;
    ag = ` Bei ${x.betrieb} Beschäftigten soll sich der Arbeitgeber mit ${frei ? '0 % (Ausnahme ab 45 Jahren möglich)' : a.prozent + ' %'} an den Lehrgangskosten beteiligen; Zuschuss zum Arbeitsentgelt bis ${z.prozent} %.`;
  }
  return out(e, STATUS.PRUEFEN, `Die Förderung läuft über den Arbeitgeber; Maßnahme und Träger müssen zugelassen sein (AZAV).${ag}`, 'Gespräch mit dem Arbeitgeber, dann gemeinsam den Arbeitgeber-Service der Agentur für Arbeit kontaktieren.');
}

function sgb81(e, x) {
  if (x.status === 'arbeitslos') return out(e, STATUS.PRUEFEN, 'Mit Bildungsgutschein übernimmt die Agentur für Arbeit bzw. das Jobcenter Lehrgangskosten, Fahrtkosten und ggf. Kinderbetreuung, wenn die Weiterbildung für die Eingliederung notwendig ist.', 'Beratungstermin vor Kursbeginn vereinbaren; nur zugelassene Maßnahmen.');
  if (x.status === 'angestellt') return out(e, STATUS.PRUEFEN, 'Für Beschäftigte kommt ein Bildungsgutschein vor allem bei drohender Arbeitslosigkeit oder fehlendem Berufsabschluss in Frage; sonst ist § 82 SGB III einschlägig.', 'Beratung bei der Agentur für Arbeit.');
  return out(e, STATUS.NEIN, 'Für Selbstständige ist der Bildungsgutschein in der Regel nicht vorgesehen.', '');
}

function sgb87a(e, x) {
  const w = e.werte;
  if (x.art !== 'umschulung' && x.art !== 'lehrabschluss') return out(e, STATUS.NEIN, 'Die Prämien gibt es nur bei einer nach § 81 geförderten Weiterbildung, die zu einem Ausbildungsberuf mit mindestens zwei Jahren Ausbildungsdauer führt (Umschulung, nachgeholter Abschluss).', '');
  return out(e, STATUS.PRUEFEN, `${eur(w.praemie_zwischen_eur)} nach bestandener Zwischenprüfung, ${eur(w.praemie_abschluss_eur)} nach bestandener Abschlussprüfung; Arbeitslose erhalten zusätzlich ${eur(w.weiterbildungsgeld_eur_monat)} Weiterbildungsgeld im Monat.`, 'Voraussetzung ist die Förderung nach § 81 – im Beratungsgespräch klären.');
}

const REGELN = {
  'at-weiterbildungsbeihilfe': weiterbildungsbeihilfe,
  'at-weiterbildungsteilzeitbeihilfe': weiterbildungsteilzeit,
  'at-fachkraeftestipendium': fachkraeftestipendium,
  'at-wien-bildungskonto-alle': wien,
  'at-wien-bildungskonto-umfangreich': wien,
  'at-wien-bildungskonto-hoehere': wien,
  'at-wien-bildungskonto-digital': wien,
  'at-wien-digi-winner': wien,
  'at-wien-chancen-scheck': wien,
  'at-ooe-bildungskonto': ooe,
  'de-bildungsurlaub': bildungsurlaub,
  'de-aufstiegs-bafoeg': aufstiegsBafoeg,
  'de-82-beschaeftigte': sgb82,
  'de-81-bildungsgutschein': sgb81,
  'de-87a-praemien': sgb87a
};

const RANG = { passt: 0, pruefen: 1, wird_geprueft: 2, passt_nicht: 3 };

/**
 * Prüft alle Einträge des Landes.
 * @param {object} daten Inhalt von foerderungen.json
 * @param {object} eingabe Formularwerte
 * @param {string} heute ISO-Datum
 */
export function pruefe(daten, eingabe, heute) {
  const x = normalisiere(eingabe);
  const res = [];
  for (const e of daten.eintraege) {
    if (e.land !== x.land) continue;
    const regel = REGELN[e.id];
    if (!regel) continue;
    if (!istAktuell(e, heute)) {
      res.push(out(e, STATUS.WIRD_GEPRUEFT, 'Die hinterlegten Werte sind abgelaufen und werden gerade an der Primärquelle geprüft.', 'Bis dahin direkt bei der Förderstelle nachsehen.'));
      continue;
    }
    res.push(regel(e, x));
  }
  res.sort((a, b) => RANG[a.status] - RANG[b.status]);
  return { eingabe: x, ergebnisse: res, hinweis: 'Orientierung, verbindlich entscheidet die Förderstelle.' };
}

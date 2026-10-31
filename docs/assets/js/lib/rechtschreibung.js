// Rechtschreibtraining für Erwachsene: eigene Übungssätze aus Berufs- und Alltagssituationen.
// Jede Aufgabe: [Thema, Satz mit ___, Auswahl, Index der richtigen Lösung, Begründung]

export const THEMEN = ['das oder dass', 'seit oder seid', 's, ss oder ß', 'Groß oder klein', 'Getrennt oder zusammen', 'wider oder wieder', 'Komma'];

const R = [
  ['das oder dass', 'Bitte bestätigen Sie, ___ die Unterlagen vollständig sind.', ['das', 'dass'], 1, 'Nach „bestätigen“ folgt ein Inhaltssatz. Probe: „dieses“ oder „welches“ passt nicht – also „dass“.'],
  ['das oder dass', 'Das Protokoll, ___ gestern verschickt wurde, enthält einen Fehler.', ['das', 'dass'], 0, 'Relativpronomen zu „Protokoll“. Ersatzprobe: „welches gestern verschickt wurde“ – also „das“.'],
  ['das oder dass', 'Wir gehen davon aus, ___ der Termin hält.', ['das', 'dass'], 1, '„davon ausgehen, dass …“: Konjunktion, die einen Nebensatz einleitet.'],
  ['das oder dass', '___ Angebot gilt bis Monatsende.', ['Das', 'Dass'], 0, 'Bestimmter Artikel vor „Angebot“.'],
  ['das oder dass', 'Ich wusste nicht, ___ es dafür eine Förderung gibt.', ['das', 'dass'], 1, 'Der Nebensatz sagt, was man nicht wusste. „Welches“ ergibt keinen Sinn – „dass“.'],
  ['das oder dass', 'Ist ___ die aktuelle Version der Tabelle?', ['das', 'dass'], 0, 'Demonstrativpronomen; es lässt sich durch „dies“ ersetzen.'],
  ['das oder dass', '___ die Prüfung verschoben wird, steht noch nicht fest.', ['Das', 'Dass'], 1, 'Der dass-Satz steht hier am Satzanfang und ist Subjekt. Ersatzprobe mit „dieses“ scheitert.'],
  ['das oder dass', 'Sie hat ein Zertifikat, ___ international anerkannt ist.', ['das', 'dass'], 0, 'Bezieht sich auf „Zertifikat“: „welches international anerkannt ist“.'],
  ['seit oder seid', 'Ich arbeite ___ März in der neuen Abteilung.', ['seit', 'seid'], 0, '„seit“ ist eine Präposition für einen Zeitpunkt oder Zeitraum.'],
  ['seit oder seid', 'Ihr ___ herzlich zur Schulung eingeladen.', ['seit', 'seid'], 1, '„seid“ ist eine Form von „sein“: ihr seid.'],
  ['seit oder seid', '___ wann gilt die neue Regelung?', ['Seit', 'Seid'], 0, 'Frage nach einem Zeitpunkt – Präposition „seit“.'],
  ['seit oder seid', '___ bitte pünktlich, der Raum ist nur bis 18 Uhr frei.', ['Seit', 'Seid'], 1, 'Aufforderung (Imperativ Plural) von „sein“.'],
  ['seit oder seid', 'Wie lange ___ ihr schon im Projekt?', ['seit', 'seid'], 1, 'Verb „sein“ in der 2. Person Plural.'],
  ['seit oder seid', '___ die Software aktualisiert wurde, läuft der Export stabil.', ['Seit', 'Seid'], 0, 'Hier ist „seit“ eine Konjunktion mit zeitlicher Bedeutung („seitdem“).'],
  ['s, ss oder ß', 'Nach dem ___ der Präsentation gab es Fragen.', ['Schlus', 'Schluss', 'Schluß'], 1, 'Nach kurzem Vokal steht „ss“: Schluss.'],
  ['s, ss oder ß', 'Der Kurs kostet einen ___ Teil des Gehalts.', ['großen', 'grossen', 'grosen'], 0, 'Langer Vokal vor stimmlosem s-Laut: „ß“ (in Österreich und Deutschland).'],
  ['s, ss oder ß', 'Sie ___, dass die Frist läuft.', ['weis', 'weiß', 'weiss'], 1, 'Nach dem Doppellaut „ei“ steht bei stimmlosem s-Laut „ß“.'],
  ['s, ss oder ß', 'Wir ___ den Bericht bis Freitag fertigstellen.', ['müssen', 'müßen', 'müsen'], 0, 'Kurzer Vokal „ü“ → „ss“.'],
  ['s, ss oder ß', 'Das Ergebnis ist ___ nicht endgültig.', ['bisher', 'bissher', 'bißher'], 0, 'Zusammensetzung aus „bis“ und „her“; „bis“ wird mit einfachem s geschrieben.'],
  ['s, ss oder ß', 'Die ___ für die Anmeldung ist knapp.', ['Frist', 'Frisst', 'Frißt'], 0, 'Einfaches s vor t im Wortstamm: Frist. „frisst“ kommt von „fressen“.'],
  ['s, ss oder ß', 'Er ___ die Tür hinter sich.', ['schloss', 'schloß', 'schlos'], 0, 'Kurzer Vokal „o“ → „ss“ (Präteritum von „schließen“).'],
  ['Groß oder klein', 'Wir wünschen Ihnen alles ___ für die Prüfung.', ['gute', 'Gute'], 1, 'Nach „alles“ wird das Adjektiv als Nomen gebraucht: alles Gute.'],
  ['Groß oder klein', 'Beim ___ hilft ein fester Zeitplan.', ['lernen', 'Lernen'], 1, 'Nach „beim“ (bei dem) wird das Verb zum Nomen.'],
  ['Groß oder klein', 'Der Kurs findet jeden ___ statt.', ['montag', 'Montag'], 1, 'Wochentage sind Nomen.'],
  ['Groß oder klein', 'Wir treffen uns ___ um zehn.', ['montags', 'Montags'], 0, 'Mit -s am Ende ist es ein Adverb: montags, abends.'],
  ['Groß oder klein', 'Haben Sie etwas ___ entdeckt?', ['neues', 'Neues'], 1, 'Nach „etwas“ wird das Adjektiv nominalisiert: etwas Neues.'],
  ['Groß oder klein', 'Bitte füllen Sie das Formular ___ aus.', ['vollständig', 'Vollständig'], 0, 'Adverb zum Verb „ausfüllen“ – klein.'],
  ['Groß oder klein', 'Im ___ ist die Lage gut.', ['allgemeinen', 'Allgemeinen'], 1, 'Feste Wendung mit Artikel: im Allgemeinen.'],
  ['Groß oder klein', 'Ich danke ___ für die Rückmeldung. (Anrede im Brief, Höflichkeitsform)', ['ihnen', 'Ihnen'], 1, 'Die Höflichkeitsanrede „Sie/Ihnen/Ihr“ wird großgeschrieben.'],
  ['Getrennt oder zusammen', 'Wir müssen den Termin ___.', ['verschieben', 'ver schieben'], 0, 'Verb mit untrennbarer Vorsilbe – ein Wort.'],
  ['Getrennt oder zusammen', 'Das Dokument ist ___ formatiert.', ['gut lesbar', 'gutlesbar'], 0, 'Adjektiv + Adjektiv, beide behalten ihre Bedeutung – getrennt.'],
  ['Getrennt oder zusammen', 'Bitte ___ Sie die Datei vor dem Versand.', ['zusammenfassen', 'zusammen fassen'], 0, 'Neue Gesamtbedeutung („kürzen“): zusammenfassen.'],
  ['s, ss oder ß', 'Die Abgabe erfolgt ___ per E-Mail.', ['ausschließlich', 'ausschliesslich', 'ausschlieslich'], 0, 'Langer Doppellaut „ie“ vor stimmlosem s-Laut: „ß“ (Standard in Österreich und Deutschland).'],
  ['Getrennt oder zusammen', 'Die Prüfung findet ___ statt.', ['nach wie vor', 'nachwievor'], 0, 'Feste Wendung aus drei Wörtern, immer getrennt.'],
  ['Getrennt oder zusammen', 'Wir haben uns ___ entschieden.', ['dafür', 'da für'], 0, 'Pronominaladverb aus „da“ und „für“ – ein Wort.'],
  ['Getrennt oder zusammen', 'Sie möchte den Abschluss ___.', ['nachholen', 'nach holen'], 0, 'Verb mit trennbarer Vorsilbe: im Infinitiv zusammen (aber: „sie holt ihn nach“).'],
  ['Komma', 'Wählen Sie die richtige Zeichensetzung: Anstatt den Kurs abzubrechen ___ hat sie die Prüfung verschoben.', ['abzubrechen, hat', 'abzubrechen hat'], 0, 'Eine Infinitivgruppe mit „anstatt zu“ wird immer mit Komma abgetrennt (ebenso „um zu“, „ohne zu“, „außer zu“).'],
  ['wider oder wieder', 'Bitte senden Sie mir das Formular ___ zurück.', ['wider', 'wieder'], 1, '„wieder“ = erneut, zurück.'],
  ['wider oder wieder', 'Die Aussage ___spricht den Unterlagen.', ['wider', 'wieder'], 0, '„wider“ = gegen: widersprechen.'],
  ['wider oder wieder', 'Nach der Pause ging es ___ los.', ['wider', 'wieder'], 1, 'Erneut – „wieder“.'],
  ['wider oder wieder', 'Gegen den Bescheid kann man ___spruch einlegen.', ['Wider', 'Wieder'], 0, 'Widerspruch = Einwand dagegen.'],
  ['wider oder wieder', 'Die Ergebnisse ___spiegeln den Aufwand.', ['wider', 'wieder'], 0, '„widerspiegeln“: zurückwerfen wie ein Spiegel, Stamm „wider“.'],
  ['Komma', 'Wählen Sie die richtige Zeichensetzung: Ich hoffe ___ die Unterlagen kommen rechtzeitig an.', ['hoffe, die', 'hoffe die'], 0, 'Ein Hauptsatz ohne Einleitewort, der von „hoffen“ abhängt, wird mit Komma abgetrennt.'],
  ['Komma', 'Wählen Sie die richtige Zeichensetzung: Nachdem der Kurs begonnen hatte ___ kam die Bestätigung.', ['hatte, kam', 'hatte kam'], 0, 'Nebensatz vor dem Hauptsatz – Komma dazwischen.'],
  ['Komma', 'Wählen Sie die richtige Zeichensetzung: Wir brauchen Lebenslauf ___ Zeugnis und Meldezettel.', ['Lebenslauf, Zeugnis', 'Lebenslauf Zeugnis'], 0, 'Aufzählung: Komma zwischen den Gliedern, vor „und“ keines.'],
  ['Komma', 'Wählen Sie die richtige Zeichensetzung: Sie lernt abends ___ weil sie tagsüber arbeitet.', ['abends, weil', 'abends weil'], 0, '„weil“ leitet einen Nebensatz ein – Komma davor.'],
  ['Komma', 'Wählen Sie die richtige Zeichensetzung: Bitte melden Sie sich ___ falls Fragen offen sind.', ['sich, falls', 'sich falls'], 0, '„falls“ leitet einen Nebensatz ein.']
];

export const AUFGABEN = R.map(([thema, satz, optionen, loesung, erklaerung], i) => ({ id: 'r' + (i + 1), thema, satz, optionen, loesung, erklaerung }));

/** Reihenfolge für eine Runde: Thema filtern, optional nur zuletzt falsche, deterministisch gemischt. */
export function runde(aufgaben, thema, nurFehler, ergebnisse, saat = 1) {
  let l = aufgaben.filter(a => !thema || a.thema === thema);
  if (nurFehler) l = l.filter(a => ergebnisse[a.id] === false);
  // Fisher-Yates mit einfachem LCG, damit Tests reproduzierbar sind
  let s = saat >>> 0 || 1;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  l = l.slice();
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

export function auswerten(aufgabe, wahl) {
  return { richtig: wahl === aufgabe.loesung, loesung: aufgabe.optionen[aufgabe.loesung], erklaerung: aufgabe.erklaerung };
}

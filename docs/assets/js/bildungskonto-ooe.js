import { istAktuell, ooeBetrag } from './lib/foerdercheck.js';
import { heuteLokal } from './lib/datum.js';

const form = document.getElementById('ooe-rechner');
const output = document.getElementById('ooe-ergebnis');
const euro = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });

async function starten() {
  const response = await fetch('/data/foerderungen.json', { cache: 'no-cache' });
  if (!response.ok) return;
  const { eintraege } = await response.json();
  const programm = eintraege.find(eintrag => eintrag.id === 'at-ooe-bildungskonto');
  if (!programm || !istAktuell(programm, heuteLokal())) return;
  const werte = programm.werte;
  form.addEventListener('input', () => { output.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const { kosten, zuschuss, art, rest } = form.elements;
    const gebuehr = kosten.valueAsNumber;
    const hilfe = zuschuss.value === '' ? 0 : zuschuss.valueAsNumber;
    if (hilfe > gebuehr) {
      output.textContent = 'Der Zuschuss darf die reine Kursgebühr nicht übersteigen. Bitte prüfen Sie beide Beträge.';
      return;
    }
    if (gebuehr < werte.kurskosten_min_eur) {
      output.textContent = 'Die reine Kursgebühr liegt unter der Mindestgrenze von ' + euro.format(werte.kurskosten_min_eur) + '.';
      return;
    }
    const eigenkosten = Math.round((gebuehr - hilfe) * 100) / 100;
    const verbleibend = rest.value === '' ? Infinity : rest.valueAsNumber;
    const { prozent, maximum, betrag } = ooeBetrag(werte, art.value, eigenkosten, verbleibend);
    output.textContent = 'Möglicher Zuschuss: ' + euro.format(betrag) + '. Berechnet aus ' + euro.format(eigenkosten)
      + ' anrechenbaren Kurskosten bei ' + prozent + ' %. Höchstbetrag für 2023–2028: ' + euro.format(maximum)
      + '. Von der Kursgebühr bleiben rechnerisch ' + euro.format(eigenkosten - betrag) + ' selbst zu tragen. Das Land prüft Ihre Voraussetzungen.';
  });
  form.hidden = false;
}

// Die Tabelle, das Rechenbeispiel und der Weg zum Antrag funktionieren auch ohne JavaScript.
starten().catch(() => {});

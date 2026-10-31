import { loescheAlles } from './speicher.js';

const b = document.getElementById('delete-local');
const s = document.getElementById('delete-status');
if (b) b.addEventListener('click', () => {
  if (!confirm('Alle auf diesem Gerät gespeicherten Lernpläne, Karteikarten und Übungsstände löschen?')) return;
  s.textContent = loescheAlles() ? 'Gelöscht. Auf diesem Gerät sind keine Lernfunkenwelt-Daten mehr gespeichert.' : 'Der Browser hat den Zugriff verweigert. Bitte die Websitedaten in den Browsereinstellungen löschen.';
});

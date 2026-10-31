# lernfunkenwelt.de – Weiterbildung mit Plan

Statische Website, ausgeliefert über GitHub Pages aus `docs/`.

- Seitenquellen: `src/pages/*.html` (Kopfkommentar mit Meta-Daten), Zusammenbau: `npm run build`
- Förderdaten: `docs/data/foerderungen.json` (je Eintrag Quelle, Stand, Prüfdatum, gültig bis)
- Werbeplätze: Slot-IDs in `config/site.json` eintragen, dann `npm run build`. Ohne Slot-ID wird kein Platz ausgegeben.
- PDF-Lernplaner (Phase 2): `produkt_pdf_lernplaner.aktiv` bleibt `false` bis zur Freigabe.
- Prüfungen: `npm test` (Unit), `npm run check` (Seitenprüfung), `npm run build:preview-ads && node scripts/e2e.mjs .preview` (Browser)
- Weiterleitungen für den späteren Umzug: `REDIRECTS.md`

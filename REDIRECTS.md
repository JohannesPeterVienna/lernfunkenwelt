# Weiterleitungen lernfunkenwelt.de (für den späteren DNS-/Hosting-Schritt)

Stand: 31.10.2026. GitHub Pages kann weder 301 noch 410 senden. Bis zum Umzug liefert `docs/` deshalb
kleine Ersatzseiten aus: Weiterleitungen als `meta refresh` + `canonical` auf das Ziel (noindex),
entfernte Kinderinhalte sind seit 2.11.2026 gelöscht (GitHub Pages liefert 404).
Sobald ein Server mit Weiterleitungsregeln (z. B. World4You `.htaccess`) davorsteht, die Spalte „Server-Regel“ umsetzen.

| Alt-URL | Neue URL | Server-Regel | Übergang auf GitHub Pages |
|---|---|---|---|
| https://lernfunkenwelt.de/ | https://lernfunkenwelt.de/ | bleibt (neuer Inhalt) | – |
| https://lernfunkenwelt.de/zehneruebergang.html | – | 404 | Datei entfernt (2.11.2026) |
| https://lernfunkenwelt.de/stellenwerte.html | – | 404 | Datei entfernt (2.11.2026) |
| https://lernfunkenwelt.de/rechenfehler-pruefen.html | – | 404 | Datei entfernt (2.11.2026) |
| https://lernfunkenwelt.de/parents.html | – | 404 | Datei entfernt (2.11.2026) |
| https://lernfunkenwelt.de/das-dass.html | https://lernfunkenwelt.de/rechtschreibung/ | 301 | meta refresh + canonical |
| https://lernfunkenwelt.de/about.html | https://lernfunkenwelt.de/ueber-uns/ | 301 | meta refresh + canonical |
| https://lernfunkenwelt.de/imprint.html | https://lernfunkenwelt.de/impressum/ | 301 | meta refresh + canonical |
| https://lernfunkenwelt.de/privacy.html | https://lernfunkenwelt.de/datenschutz/ | 301 | meta refresh + canonical |
| https://lernfunkenwelt.de/advertise.html | https://lernfunkenwelt.de/ueber-uns/#werbung | 301 | meta refresh + canonical |
| https://abruf.lernfunkenwelt.de/ (und alle Pfade) | https://lernfunkenwelt.de/karteikarten/ | 301 | Subdomain bleibt bis zum Umzug; vorher Hinweis „Sicherung speichern“ setzen (Datei ist auf /karteikarten/ importierbar) |
| https://abruf.lernfunkenwelt.de/imprint.html | https://lernfunkenwelt.de/impressum/ | 301 | – |
| https://abruf.lernfunkenwelt.de/privacy.html | https://lernfunkenwelt.de/datenschutz/ | 301 | – |
| https://abruf.lernfunkenwelt.de/advertise.html | https://lernfunkenwelt.de/ueber-uns/#werbung | 301 | – |
| https://pfad.lernfunkenwelt.de/ (und alle Pfade) | https://lernfunkenwelt.de/rechtschreibung/ | 301 | Subdomain bleibt bis zum Umzug |
| https://pfad.lernfunkenwelt.de/imprint.html | https://lernfunkenwelt.de/impressum/ | 301 | – |
| https://pfad.lernfunkenwelt.de/privacy.html | https://lernfunkenwelt.de/datenschutz/ | 301 | – |
| https://pfad.lernfunkenwelt.de/advertise.html | https://lernfunkenwelt.de/ueber-uns/#werbung | 301 | – |
| https://www.lernfunkenwelt.de/* | https://lernfunkenwelt.de/* | 301 | GitHub Pages leitet www automatisch um, wenn der www-CNAME gesetzt ist |

Hinweise:
- Der alte Canonical von pfad.lernfunkenwelt.de zeigt auf `rechtschreibpfad.q4fv6rzwsc.chatgpt.site` – mit der 301-Umleitung erledigt.
- Die alten Sitemaps der Subdomains danach entfernen bzw. 301 auf https://lernfunkenwelt.de/sitemap.xml.
- Search Console: neue Sitemap erst nach Freigabe durch den Inhaber einreichen.

Beispiel `.htaccess` (Hauptdomain):

```apache
RewriteEngine On
Redirect 410 /zehneruebergang.html
Redirect 410 /stellenwerte.html
Redirect 410 /rechenfehler-pruefen.html
Redirect 410 /parents.html
RewriteRule ^das-dass\.html$ /rechtschreibung/ [R=301,L]
RewriteRule ^about\.html$ /ueber-uns/ [R=301,L]
RewriteRule ^imprint\.html$ /impressum/ [R=301,L]
RewriteRule ^privacy\.html$ /datenschutz/ [R=301,L]
RewriteRule ^advertise\.html$ /ueber-uns/#werbung [R=301,NE,L]
```

Subdomains (je eigener vHost):

```apache
RewriteEngine On
RewriteRule ^imprint\.html$ https://lernfunkenwelt.de/impressum/ [R=301,L]
RewriteRule ^privacy\.html$ https://lernfunkenwelt.de/datenschutz/ [R=301,L]
RewriteRule ^advertise\.html$ https://lernfunkenwelt.de/ueber-uns/#werbung [R=301,NE,L]
RewriteRule ^ https://lernfunkenwelt.de/karteikarten/ [R=301,L]   # bei pfad: /rechtschreibung/
```

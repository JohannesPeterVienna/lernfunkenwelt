// Sicherer Zugriff auf localStorage: Fehler (privater Modus, Speicher voll) werden abgefangen.
export const SCHLUESSEL = {
  plan: 'lfw.lernplan.v1',
  karten: 'lfw.karten.v1',
  rs: 'lfw.rechtschreibung.v1',
  check: 'lfw.foerdercheck.v1'
};

export function lies(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function schreib(key, wert) {
  try { localStorage.setItem(key, JSON.stringify(wert)); return true; } catch { return false; }
}
export function loesche(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}
export function loescheAlles() {
  let ok = true;
  for (const k of Object.values(SCHLUESSEL)) ok = loesche(k) && ok;
  return ok;
}

/** Datei herunterladen (Blob, keine Übertragung an Server). */
export function download(name, inhalt, typ) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kinder.flat()) if (c != null) e.append(c);
  return e;
}

// Einwilligung und Messung für lernfunkenwelt.de
//
// Reihenfolge im <head> (scripts/build.mjs):
//   1. Inline-Skript: gtag('consent','default', alles 'denied', wait_for_update 500)
//   2. adsbygoogle.js – bringt die Google-CMP (Privacy & Messaging, IAB TCF) mit
//   3. dieses Skript (defer)
//
// Google Analytics 4 wird nur geladen bzw. aktiv gehalten, wenn
//   a) die DSGVO gilt (gdprApplies true oder unklar): TCF Zweck 1 (Speichern/Zugriff) und
//      Anbieter 755 (Google) eingewilligt UND googlefc.getGoogleConsentModeValues()
//      .analyticsStoragePurposeConsentStatus === GRANTED (1),
//   b) die DSGVO laut CMP nicht gilt (gdprApplies === false): der Analyticswert GRANTED (1)
//      oder NOT_APPLICABLE (3) ist UND die CMP ausdrücklich keinen US-Opt-out meldet
//      (googlefc.usstatesoptout.getInitialUsStatesOptOutStatus() DOES_NOT_APPLY 1 / NOT_OPTED_OUT 2).
// Fehlend, UNKNOWN (0), DENIED (2), NOT_CONFIGURED (4) und jeder Fehler einer CMP-Schnittstelle
// werden nie zu 'granted'. Ein eindeutiges TCF-Nein schaltet sofort ab, ohne vorher weitere
// CMP-Schnittstellen aufzurufen. Ablehnung oder Widerruf: consent update 'denied' und
// window['ga-disable-<ID>'] = true (ab Seitenstart gesetzt) – danach sendet gtag.js keine Hits.
// Werte: developers.google.com/funding-choices/fc-api-docs

(() => {
  'use strict';
  const GA_ID = 'G-T00HRG2YVF';
  const GOOGLE_VENDOR = 755;
  // googlefc.ConsentModePurposeStatusEnum (developers.google.com/funding-choices/fc-api-docs)
  const CM = { UNKNOWN: 0, GRANTED: 1, DENIED: 2, NOT_APPLICABLE: 3, NOT_CONFIGURED: 4 };
  const US_KEIN_OPTOUT = [1, 2]; // usstatesoptout: DOES_NOT_APPLY, NOT_OPTED_OUT (0 UNKNOWN, 3 OPTED_OUT sperren)
  window['ga-disable-' + GA_ID] = true;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') window.gtag = gtag;
  // Rückfall, falls das Inline-Default im Kopf fehlt (z. B. alte Kopie im Cache)
  if (!window.dataLayer.some(e => e && e[0] === 'consent' && e[1] === 'default')) {
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 });
  }

  const zustand = { tc: null, gaGeladen: false, aktiv: false, gemeldet: null };

  /** TCF-Signal: 'ja' | 'nein' | 'offen' (keine Entscheidung) | 'ausserhalb' (DSGVO gilt nicht). */
  function tcfSignal(tc) {
    if (!tc) return 'offen';
    if (tc.gdprApplies === false) return 'ausserhalb';
    if (tc.eventStatus !== 'tcloaded' && tc.eventStatus !== 'useractioncomplete') return 'offen';
    const zweck1 = !!(tc.purpose && tc.purpose.consents && tc.purpose.consents[1] === true);
    const google = !!(tc.vendor && tc.vendor.consents && tc.vendor.consents[GOOGLE_VENDOR] === true);
    return zweck1 && google ? 'ja' : 'nein';
  }

  /** Consent-Mode-Status einer Zweckart → 'granted' | 'denied'. */
  function cmWert(status, ausserhalb) {
    if (status === CM.GRANTED) return 'granted';
    if (status === CM.NOT_APPLICABLE && ausserhalb) return 'granted';
    return 'denied';
  }

  /** Reine Entscheidung (für Tests exportiert). usOptOut: true, solange kein bestätigtes „kein Opt-out“ vorliegt. */
  function entscheide(tc, cm, usOptOut) {
    const signal = tcfSignal(tc);
    const ausserhalb = signal === 'ausserhalb';
    const cmZaehlt = !!cm && (signal === 'ja' || (ausserhalb && !usOptOut));
    const wert = k => cmZaehlt ? cmWert(cm[k], ausserhalb) : 'denied';
    const analytics = wert('analyticsStoragePurposeConsentStatus');
    return {
      statistik: analytics === 'granted',
      update: {
        ad_storage: wert('adStoragePurposeConsentStatus'),
        ad_user_data: wert('adUserDataPurposeConsentStatus'),
        ad_personalization: wert('adPersonalizationPurposeConsentStatus'),
        analytics_storage: analytics
      }
    };
  }
  window.__lfwEinwilligung = { entscheide, CM }; // für Tests

  function leseCm() {
    try {
      const fc = window.googlefc;
      if (!fc || typeof fc.getGoogleConsentModeValues !== 'function') return null;
      return fc.getGoogleConsentModeValues() || null;
    } catch (e) { return null; }
  }

  function leseUsOptOut() {
    try {
      const u = window.googlefc && window.googlefc.usstatesoptout;
      if (!u || typeof u.getInitialUsStatesOptOutStatus !== 'function') return true;
      return !US_KEIN_OPTOUT.includes(u.getInitialUsStatesOptOutStatus());
    } catch (e) { return true; }
  }

  function ladeGa() {
    if (zustand.gaGeladen) return;
    zustand.gaGeladen = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function anwenden() {
    const signal = tcfSignal(zustand.tc);
    // Bei 'nein'/'offen' werden keine weiteren CMP-Schnittstellen gefragt – die Sperre greift sofort.
    const cm = signal === 'ja' || signal === 'ausserhalb' ? leseCm() : null;
    const us = signal === 'ausserhalb' ? leseUsOptOut() : false;
    const d = entscheide(zustand.tc, cm, us);
    const schluessel = JSON.stringify(d.update);
    if (d.statistik) {
      window['ga-disable-' + GA_ID] = false;
      if (zustand.gemeldet !== schluessel) gtag('consent', 'update', d.update);
      zustand.gemeldet = schluessel;
      zustand.aktiv = true;
      ladeGa();
      return;
    }
    // Keine (oder keine vollständige) Einwilligung: nie granted melden.
    window['ga-disable-' + GA_ID] = true;
    zustand.aktiv = false;
    if (zustand.gemeldet !== null && zustand.gemeldet !== schluessel) gtag('consent', 'update', d.update);
    if (zustand.gemeldet !== null) zustand.gemeldet = schluessel;
  }

  function lauscheTcf(versuche) {
    if (typeof window.__tcfapi !== 'function') {
      if (versuche > 0) setTimeout(() => lauscheTcf(versuche - 1), 400);
      return;
    }
    // Der Listener feuert bei jeder Änderung der Auswahl erneut (auch Widerruf).
    window.__tcfapi('addEventListener', 2, (tc, ok) => {
      if (!ok || !tc) return;
      zustand.tc = tc;
      anwenden();
    });
  }

  function lauscheConsentMode() {
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push({
      CONSENT_MODE_DATA_READY: () => anwenden(),
      INITIAL_US_STATES_OPT_OUT_DATA_READY: () => anwenden()
    });
  }

  function befuelleAnzeigen() {
    const plaetze = document.querySelectorAll('ins.adsbygoogle[data-ad-slot]');
    plaetze.forEach(ins => {
      if (ins.dataset.lfwPush) return;
      // Seitenleisten-Plätze nur auf breiten Bildschirmen befüllen (sonst ausgeblendet)
      const box = ins.closest('.ad');
      if (box && getComputedStyle(box).display === 'none') return;
      ins.dataset.lfwPush = '1';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* Blocker: still ignorieren */ }
    });
  }

  function datenschutzLinks() {
    const cmpGeladen = !!document.querySelector('script[src*="adsbygoogle.js"]');
    document.querySelectorAll('[data-privacy-settings]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.preventDefault();
        if (!cmpGeladen) { location.href = '/datenschutz/'; return; }
        const fc = window.googlefc;
        if (fc && typeof fc.showRevocationMessage === 'function') {
          fc.showRevocationMessage();
        } else {
          window.googlefc = window.googlefc || {};
          window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
          window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => window.googlefc.showRevocationMessage() });
          const hinweis = document.getElementById('privacy-hint');
          if (hinweis) { hinweis.hidden = false; hinweis.textContent = 'Die Einstellungen öffnen sich, sobald der Einwilligungsdialog geladen ist. Ein Werbeblocker kann das verhindern.'; }
        }
      });
    });
  }

  function start() {
    datenschutzLinks();
    lauscheConsentMode();
    lauscheTcf(25);
    befuelleAnzeigen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

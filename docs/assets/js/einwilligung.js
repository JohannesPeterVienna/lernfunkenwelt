// Einwilligung und Messung für lernfunkenwelt.de
//
// Reihenfolge im <head> (scripts/build.mjs):
//   1. Inline-Skript: gtag('consent','default', alles 'denied', wait_for_update 500)
//   2. adsbygoogle.js – bringt die Google-CMP (Privacy & Messaging, IAB TCF) mit
//   3. dieses Skript (defer)
//
// Google Analytics 4 wird nur geladen bzw. aktiv gehalten, wenn BEIDE Signale zustimmen:
//   a) TCF: Zweck 1 (Speichern/Zugriff) und Anbieter 755 (Google) eingewilligt
//      (oder gdprApplies === false),
//   b) Google Consent Mode aus der CMP: googlefc.getGoogleConsentModeValues()
//      .analyticsStoragePurposeConsentStatus === GRANTED
//      (NOT_APPLICABLE nur zusammen mit gdprApplies === false).
// UNKNOWN, DENIED und NOT_CONFIGURED werden nie zu 'granted'.
// Ablehnung oder Widerruf nach früherer Zustimmung: consent update 'denied' und
// window['ga-disable-<ID>'] = true – danach sendet gtag.js keine Hits mehr.

(() => {
  'use strict';
  const GA_ID = 'G-T00HRG2YVF';
  const GOOGLE_VENDOR = 755;
  // googlefc.ConsentModePurposeStatusEnum (developers.google.com/funding-choices/fc-api-docs)
  const CM = { UNKNOWN: 0, GRANTED: 1, DENIED: 2, NOT_APPLICABLE: 3, NOT_CONFIGURED: 4 };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') window.gtag = gtag;
  // Rückfall, falls das Inline-Default im Kopf fehlt (z. B. alte Kopie im Cache)
  if (!window.dataLayer.some(e => e && e[0] === 'consent' && e[1] === 'default')) {
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 });
  }

  const zustand = { tc: null, cm: null, gaGeladen: false, aktiv: false, gemeldet: null };

  /** TCF-Signal: true/false, oder null solange keine Entscheidung vorliegt. */
  function tcfErlaubt(tc) {
    if (!tc) return null;
    if (tc.gdprApplies === false) return true;
    if (tc.eventStatus !== 'tcloaded' && tc.eventStatus !== 'useractioncomplete') return null;
    const zweck1 = !!(tc.purpose && tc.purpose.consents && tc.purpose.consents[1] === true);
    const google = !!(tc.vendor && tc.vendor.consents && tc.vendor.consents[GOOGLE_VENDOR] === true);
    return zweck1 && google;
  }

  /** Consent-Mode-Status einer Zweckart → 'granted' | 'denied'. Nur GRANTED wird granted. */
  function cmWert(status, tc) {
    if (status === CM.GRANTED) return 'granted';
    if (status === CM.NOT_APPLICABLE && tc && tc.gdprApplies === false) return 'granted';
    return 'denied';
  }

  /** Reine Entscheidung (für Tests exportiert). */
  function entscheide(tc, cm) {
    const tcf = tcfErlaubt(tc);
    const analytics = cm ? cmWert(cm.analyticsStoragePurposeConsentStatus, tc) : 'denied';
    return {
      statistik: tcf === true && analytics === 'granted',
      update: {
        ad_storage: cm ? cmWert(cm.adStoragePurposeConsentStatus, tc) : 'denied',
        ad_user_data: cm ? cmWert(cm.adUserDataPurposeConsentStatus, tc) : 'denied',
        ad_personalization: cm ? cmWert(cm.adPersonalizationPurposeConsentStatus, tc) : 'denied',
        analytics_storage: tcf === true && analytics === 'granted' ? 'granted' : 'denied'
      }
    };
  }
  window.__lfwEinwilligung = { entscheide, CM }; // für Tests

  function leseCm() {
    const fc = window.googlefc;
    if (!fc || typeof fc.getGoogleConsentModeValues !== 'function') return null;
    try { return fc.getGoogleConsentModeValues() || null; } catch (e) { return null; }
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
    const cm = leseCm() || zustand.cm;
    zustand.cm = cm;
    const d = entscheide(zustand.tc, cm);
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
    if (zustand.aktiv || zustand.gaGeladen) {
      window['ga-disable-' + GA_ID] = true;
      zustand.aktiv = false;
    }
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
    window.googlefc.callbackQueue.push({ CONSENT_MODE_DATA_READY: () => anwenden() });
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

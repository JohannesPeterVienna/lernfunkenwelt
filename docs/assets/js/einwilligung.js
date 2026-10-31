// Einwilligung und Messung für lernfunkenwelt.de
// Ablauf: adsbygoogle.js wird asynchron im Kopf geladen und bringt Googles
// zertifizierte TCF-2.2-CMP (Privacy & Messaging) mit. Dieses Skript wartet auf die
// TC-Daten der CMP und lädt Google Analytics 4 erst, wenn Zweck 1 (Speichern/Zugriff)
// und Anbieter 755 (Google) eingewilligt sind. Ohne Einwilligung wird GA4 nie geladen.
// Werbeplätze werden nur befüllt, wenn das Kopf-Skript Slot-IDs ausgegeben hat.

(() => {
  'use strict';
  const GA_ID = 'G-T00HRG2YVF';
  const GOOGLE_VENDOR = 755;
  let gaGeladen = false;

  // Consent Mode v2: konservative Grundeinstellung, bevor irgendetwas misst.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  });

  function ladeGa() {
    if (gaGeladen) return;
    gaGeladen = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  /** Erfüllt die TC-Zeichenkette die Voraussetzungen für Statistik? */
  function erlaubtStatistik(tc) {
    if (!tc) return false;
    if (tc.gdprApplies === false) return true;
    const zweck1 = tc.purpose && tc.purpose.consents && tc.purpose.consents[1] === true;
    const google = tc.vendor && tc.vendor.consents && tc.vendor.consents[GOOGLE_VENDOR] === true;
    return !!(zweck1 && google);
  }
  window.__lfwErlaubtStatistik = erlaubtStatistik; // für Tests

  function lauscheTcf(versuche) {
    if (typeof window.__tcfapi !== 'function') {
      if (versuche > 0) setTimeout(() => lauscheTcf(versuche - 1), 400);
      return;
    }
    window.__tcfapi('addEventListener', 2, (tc, ok) => {
      if (!ok || !tc) return;
      if (tc.eventStatus === 'tcloaded' || tc.eventStatus === 'useractioncomplete') {
        if (erlaubtStatistik(tc)) ladeGa();
      }
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
    document.querySelectorAll('[data-privacy-settings]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.preventDefault();
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
    lauscheTcf(25);
    befuelleAnzeigen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

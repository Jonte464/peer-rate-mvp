// frontend/modules/ratingPlatform.js
// Backwards compatible module.
//
// Legacy pages may call initRatingPlatform().
// Newer rate.html flow uses initPlatformPicker/initPlatformStarter.
//
// Strategy:
// - If legacy "hub" elements exist (choosePlatformBtn/chooseEmailBtn), run legacy UI.
// - Otherwise, fall back to new pickers (no-op if not present).

import { initPlatformPicker, initPlatformStarter } from './platformPicker.js';
import { t } from '../landing/language.js';
import { escapeHtml } from './verifiedDealUI.js';

export function initRatingPlatform() {
  const platformCard = document.getElementById('platform-card');
  const emailCard = document.getElementById('email-card');

  const choosePlatformBtn = document.getElementById('choosePlatformBtn');
  const chooseEmailBtn = document.getElementById('chooseEmailBtn');

  const select = document.getElementById('platformSelect');
  const flow = document.getElementById('platformFlow');
  const btn = document.getElementById('platformGoBtn');

  // ✅ If legacy hub buttons are NOT present, we're likely on the new rate page.
  // Fall back to new modules (safe no-op if elements not present).
  if (!choosePlatformBtn || !chooseEmailBtn) {
    try { initPlatformPicker(); } catch (e) { console.warn('[PeerRate] initPlatformPicker failed', e); }
    try { initPlatformStarter(); } catch (e) { console.warn('[PeerRate] initPlatformStarter failed', e); }
    return;
  }

  const urls = {
    tradera: 'https://www.tradera.com/',
    blocket: 'https://www.blocket.se/',
    airbnb: 'https://www.airbnb.com/',
    ebay: 'https://www.ebay.com/',
    tiptap: 'https://tiptap.se/',
    hygglo: 'https://www.hygglo.se/',
    husknuten: 'https://www.husknuten.se/',
    facebook: 'https://www.facebook.com/marketplace/',
  };

  function showPlatform() {
    if (platformCard) platformCard.style.display = 'block';
    if (emailCard) emailCard.style.display = 'none';
    platformCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showEmail() {
    if (emailCard) emailCard.style.display = 'block';
    if (platformCard) platformCard.style.display = 'none';
    emailCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  choosePlatformBtn.addEventListener('click', showPlatform);
  chooseEmailBtn.addEventListener('click', showEmail);

  // Default: show platform if coming with ?source=... (from extension)
  const params = new URLSearchParams(window.location.search || '');
  if ((params.get('source') || '').trim()) showPlatform();

  function updateBtn() {
    if (!select || !flow || !btn) return;
    const hasPlatform = !!urls[select.value];
    const hasFlow = !!(flow.value || '').trim();
    btn.disabled = !(hasPlatform && hasFlow);
  }

  function flowLabel(v) {
    return (
      {
        buy: t('rate_platform_flow_buy', 'Köp'),
        sell: t('rate_platform_flow_sell', 'Sälj'),
        booking: t('rate_platform_flow_booking', 'Bokning/hyra'),
        other: t('rate_platform_flow_other', 'Annat'),
      }[v] || ''
    );
  }

  function platformLabel(k) {
    const map = {
      tradera: 'Tradera',
      blocket: 'Blocket',
      airbnb: 'Airbnb',
      ebay: 'eBay',
      tiptap: 'Tiptap',
      hygglo: 'Hygglo',
      husknuten: 'Husknuten',
      facebook: 'Facebook Marketplace',
    };
    return map[k] || k;
  }

  function updateStepsText() {
    const steps = document.getElementById('platformSteps');
    if (!steps) return;

    const p = select?.value;
    const f = flow?.value;
    if (!p || !f) return;

    const pName = platformLabel(p);
    const fName = flowLabel(f);

    steps.innerHTML = `
      <b>${escapeHtml(t('rate_platform_how_dynamic', 'Så gör du'))} (${escapeHtml(pName)} · ${escapeHtml(fName)}):</b>
      <ol style="margin:6px 0 0 18px;padding:0;">
        <li>${escapeHtml(t('rate_platform_dynamic_open', 'Öppna'))} ${escapeHtml(pName)}.</li>
        <li>${escapeHtml(t('rate_platform_dynamic_find_deal', 'Logga in och hitta den avslutade affären, gärna completed, orders eller receipt/kvitto.'))}</li>
        <li>${escapeHtml(t('rate_platform_dynamic_open_receipt', 'Öppna gärna order-, receipt- eller kvittovyn om den finns.'))}</li>
        <li>${escapeHtml(t('rate_platform_dynamic_click_extension', 'Klicka på PeerRate-extensionen för att skicka verifierad info.'))}</li>
      </ol>
    `;
  }

  select?.addEventListener('change', () => {
    updateBtn();
    updateStepsText();
  });

  flow?.addEventListener('change', () => {
    updateBtn();
    updateStepsText();
  });

  btn?.addEventListener('click', () => {
    const key = select.value;
    const url = urls[key];
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  updateBtn();
  updateStepsText();
}

// ✅ Optional: export the new APIs too, so older imports can use them
export { initPlatformPicker, initPlatformStarter };
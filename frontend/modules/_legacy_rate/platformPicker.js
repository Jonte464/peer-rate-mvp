// frontend/modules/platformPicker.js
import { getPending, setPending } from './pendingStore.js';
import { applyPendingContextCard, renderVerifiedDealUI } from './verifiedDealUI.js';

function isRatePage() {
  return (window.location.pathname || '').toLowerCase().includes('/rate.html');
}

export function initPlatformPicker() {
  if (!isRatePage()) return;

  const select = document.getElementById('platformSelect');
  const goBtn = document.getElementById('platformGoBtn');

  const instructions =
    document.getElementById('platformInstructions') ||
    document.getElementById('platformNote') ||
    null;

  if (!select || !goBtn) return;

  const platforms = {
    tradera: {
      label: 'Tradera',
      url: 'https://www.tradera.com/',
      tip_sv: 'Öppna ordern på Tradera. När du är på rätt sida: klicka på PeerRate-extensionen.',
      tip_en: 'Open the order on Tradera. When you are on the right page: click the PeerRate extension.'
    },
    blocket: {
      label: 'Blocket',
      url: 'https://www.blocket.se/',
      tip_sv: 'Öppna annons/profil. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open listing/profile. Click the extension to send verified info.'
    },
    airbnb: {
      label: 'Airbnb',
      url: 'https://www.airbnb.com/',
      tip_sv: 'Öppna resa/konversation. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open trip/thread. Click the PeerRate extension.'
    },
    ebay: {
      label: 'eBay',
      url: 'https://www.ebay.com/',
      tip_sv: 'Öppna order. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open order. Click the PeerRate extension.'
    },
    tiptap: {
      label: 'Tiptap',
      url: 'https://tiptapp.se/',
      tip_sv: 'Öppna relevant sida. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open relevant page. Click the PeerRate extension.'
    },
    hygglo: {
      label: 'Hygglo',
      url: 'https://www.hygglo.se/',
      tip_sv: 'Öppna bokning. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open booking. Click the PeerRate extension.'
    },
    husknuten: {
      label: 'Husknuten',
      url: 'https://husknuten.se/',
      tip_sv: 'Öppna bokning. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open booking. Click the PeerRate extension.'
    },
    facebook_marketplace: {
      label: 'Facebook Marketplace',
      url: 'https://www.facebook.com/marketplace/',
      tip_sv: 'Öppna annons/konversation. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open listing/thread. Click the PeerRate extension.'
    },
  };

  function getLang() {
    return (document.documentElement.lang || 'sv').toLowerCase().startsWith('en') ? 'en' : 'sv';
  }

  function setGoEnabled(enabled) {
    goBtn.disabled = !enabled;
    goBtn.style.pointerEvents = enabled ? 'auto' : 'none';
    goBtn.style.opacity = enabled ? '1' : '.55';
  }

  function renderTip(key) {
    const p = platforms[key];
    if (!p || !instructions) return;
    const lang = getLang();
    const tip = (lang === 'en') ? (p.tip_en || '') : (p.tip_sv || '');
    instructions.textContent = tip;
  }

  function onSelect() {
    const key = select.value || '';
    const p = platforms[key];
    if (!p) {
      setGoEnabled(false);
      return;
    }
    setGoEnabled(true);
    renderTip(key);
  }

  const qs = new URLSearchParams(window.location.search || '');
  const sourceRaw = (qs.get('source') || '').trim().toLowerCase();

  const sourceMap = {
    tradera: 'tradera',
    blocket: 'blocket',
    airbnb: 'airbnb',
    ebay: 'ebay',
    tiptap: 'tiptap',
    tiptapp: 'tiptap',
    hygglo: 'hygglo',
    husknuten: 'husknuten',
    facebook: 'facebook_marketplace',
    marketplace: 'facebook_marketplace',
    'facebook marketplace': 'facebook_marketplace'
  };

  const pending = getPending();
  const pendingSource = (pending?.source || '').toString().trim().toLowerCase();

  const resolved = sourceMap[sourceRaw] || sourceMap[pendingSource] || '';
  if (resolved && platforms[resolved]) select.value = resolved;

  setGoEnabled(false);
  onSelect();
  select.addEventListener('change', onSelect);

  goBtn.addEventListener('click', () => {
    const key = (select.value || '').trim();
    const p = platforms[key];
    if (!p) return;
    window.open(p.url, '_blank', 'noopener,noreferrer');
  });

  const mo = new MutationObserver(() => {
    const key = select.value || '';
    if (platforms[key]) renderTip(key);
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

export function initPlatformStarter() {
  const select = document.getElementById('platformSelect');
  const btn = document.getElementById('platformGoBtn');
  if (!select || !btn) return;

  const platforms = {
    tradera:  { label: 'Tradera', url: 'https://www.tradera.com/' },
    blocket:  { label: 'Blocket', url: 'https://www.blocket.se/' },
    airbnb:   { label: 'Airbnb',  url: 'https://www.airbnb.com/' },
    ebay:     { label: 'eBay',    url: 'https://www.ebay.com/' },
    tiptap:   { label: 'Tiptap',  url: 'https://www.tiptapp.se/' },
    hygglo:   { label: 'Hygglo',  url: 'https://www.hygglo.se/' },
    husknuten:{ label: 'Husknuten', url: 'https://www.husknuten.se/' },
    facebook: { label: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/' },
  };

  const syncBtn = () => {
    const key = (select.value || '').trim();
    btn.disabled = !key || !platforms[key];
  };

  select.addEventListener('change', () => {
    const key = (select.value || '').trim();
    if (key && platforms[key]) {
      const existing = getPending() || {};
      setPending({ ...existing, source: platforms[key].label });
      const p = getPending();
      applyPendingContextCard(p);
      renderVerifiedDealUI(p);
    }
    syncBtn();
  });

  btn.addEventListener('click', () => {
    const key = (select.value || '').trim();
    const p = platforms[key];
    if (!p) return;
    window.open(p.url, '_blank', 'noopener,noreferrer');
  });

  syncBtn();
}
// extension/content.js
// Adapter-baserad orchestrator för PeerRate extension.
// Ansvar:
// 1) hitta rätt adapter för aktuell sida
// 2) injicera en knapp
// 3) bygga payload via adapter
// 4) öppna PeerRate rate.html med payload i hash
//
// Ingen service worker
// Ingen backend-check
// Ingen bridge
// Ingen chrome.runtime.sendMessage

(function () {
  const BTN_ID = 'peerrate-float-btn';
  const LOG_PREFIX = '[PeerRate extension]';

  function log(...args) {
    try {
      console.log(LOG_PREFIX, ...args);
    } catch {}
  }

  function getAdapters() {
    const platforms = window.PeerRatePlatforms || {};
    return Object.values(platforms).filter(Boolean);
  }

  function getActiveAdapter() {
    const adapters = getAdapters();

    for (const adapter of adapters) {
      try {
        if (typeof adapter.matches === 'function' && adapter.matches()) {
          return adapter;
        }
      } catch (error) {
        log('Adapter match failed', adapter?.id, error);
      }
    }

    return null;
  }

  function buildRateUrlFromPayload(payload) {
    const shared = window.PeerRateShared || {};
    const payloadUtils = shared.payload || {};

    if (typeof payloadUtils.buildRateUrl !== 'function') {
      throw new Error('Missing payload helper: buildRateUrl');
    }

    return payloadUtils.buildRateUrl(payload);
  }

  function openRatePage(adapter) {
    if (!adapter || typeof adapter.buildPayload !== 'function') {
      log('No valid adapter available for openRatePage');
      return;
    }

    let payload;
    let url;

    try {
      payload = adapter.buildPayload();
      url = buildRateUrlFromPayload(payload);
    } catch (error) {
      log('Failed to build payload/url', adapter?.id, error);
      return;
    }

    log('Opening rate page with adapter', adapter.id);
    log('Payload', payload);
    log('URL', url);

    window.open(url, '_blank', 'noopener');
  }

  function removeButton() {
    const oldBtn = document.getElementById(BTN_ID);
    if (oldBtn) {
      oldBtn.remove();
    }
  }

  function createButton(adapter) {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = adapter?.label || 'Betygsätt med PeerRate';

    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '999999',
      background: 'linear-gradient(135deg, #0b1f3b, #132f55)',
      color: '#ffffff',
      padding: '14px 18px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.15)',
      fontSize: '14px',
      fontWeight: '700',
      letterSpacing: '0.2px',
      cursor: 'pointer',
      boxShadow: '0 16px 40px rgba(0,0,0,0.45)'
    });

    btn.addEventListener('click', () => openRatePage(adapter));

    return btn;
  }

  function ensureButton() {
    const adapter = getActiveAdapter();

    if (!adapter) {
      removeButton();
      return;
    }

    const existing = document.getElementById(BTN_ID);
    if (existing) {
      const currentAdapterId = existing.getAttribute('data-adapter-id') || '';
      if (currentAdapterId === adapter.id) {
        return;
      }
      existing.remove();
    }

    const btn = createButton(adapter);
    btn.setAttribute('data-adapter-id', adapter.id);
    document.documentElement.appendChild(btn);

    log('Button injected for adapter', adapter.id);
  }

  function startMutationObserver() {
    const observer = new MutationObserver(() => {
      ensureButton();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function startUrlWatcher() {
    let lastHref = location.href;

    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        log('URL changed', lastHref);
        ensureButton();
      }
    }, 500);
  }

  function start() {
    log('Starting extension orchestrator');
    ensureButton();
    startMutationObserver();
    startUrlWatcher();
  }

  start();
})();
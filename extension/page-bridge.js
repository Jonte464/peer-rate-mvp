// extension/page-bridge.js
// Superenkel lösning:
// - körs på peerrate.ai
// - hämtar pending payload direkt från service-worker
// - skriver den direkt till localStorage för rate-sidan
// - rensar extensionens pending payload efter lyckad överföring
//
// Ingen window.postMessage-brygga behövs längre för själva transporten.

(function () {
  const LOCAL_PENDING_KEY = 'peerrate_pending_rating_v6';

  function log(...args) {
    try {
      console.log('[PeerRate bridge]', ...args);
    } catch {}
  }

  function safeSendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          resolve(response || { ok: false, error: 'No response' });
        });
      } catch (err) {
        resolve({
          ok: false,
          error: String(err?.message || err || 'unknown'),
        });
      }
    });
  }

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function readLocalPending() {
    try {
      const raw = localStorage.getItem(LOCAL_PENDING_KEY);
      return raw ? safeParse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocalPending(payload) {
    try {
      const withTs = {
        ...(payload || {}),
        _ts: Date.now(),
      };

      localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(withTs));
      return true;
    } catch (err) {
      log('writeLocalPending failed', err);
      return false;
    }
  }

  function mergeObjects(base, incoming) {
    const a = base && typeof base === 'object' ? base : {};
    const b = incoming && typeof incoming === 'object' ? incoming : {};

    return {
      ...a,
      ...b,
      counterparty: {
        ...(a.counterparty || {}),
        ...(b.counterparty || {}),
      },
      deal: {
        ...(a.deal || {}),
        ...(b.deal || {}),
        counterparty: {
          ...(a.deal?.counterparty || {}),
          ...(b.deal?.counterparty || {}),
        },
      },
    };
  }

  async function hydratePendingFromExtension() {
    const url = new URL(window.location.href);
    const wantsPending = url.searchParams.get('pr_pending') === '1';

    if (!wantsPending) {
      return;
    }

    log('pr_pending detected, asking service worker for payload...');

    const response = await safeSendRuntimeMessage({
      type: 'getPendingPayloadForPage',
    });

    if (!response?.ok || !response?.payload) {
      log('No pending payload available from service worker', response);
      return;
    }

    const existing = readLocalPending();
    const merged = mergeObjects(existing, response.payload);
    const stored = writeLocalPending(merged);

    if (!stored) {
      log('Could not store payload in localStorage');
      return;
    }

    log('Pending payload stored in localStorage', merged);

    await safeSendRuntimeMessage({
      type: 'clearPendingPayloadForPage',
    });

    try {
      url.searchParams.delete('pr_pending');
      window.history.replaceState({}, '', url.toString());
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent('pr:pending-updated', {
          detail: merged,
        })
      );
    } catch {}
  }

  async function markDealRatedFromPage(payload) {
    const proofRef = String(payload?.proofRef || payload?.deal?.orderId || '').trim();
    const source = String(payload?.source || payload?.deal?.platform || '').trim();

    if (!proofRef || !source) return;

    const response = await safeSendRuntimeMessage({
      type: 'markDealRatedFromPage',
      payload,
    });

    log('markDealRatedFromPage response', response);
  }

  // Behåll denna endast för att inte bryta befintlig frontendkod som postar detta meddelande
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'PEERRATE_MARK_DEAL_RATED') {
        void markDealRatedFromPage(data.payload || {});
      }
    } catch (err) {
      log('message handler failed', err);
    }
  });

  void hydratePendingFromExtension();
})();
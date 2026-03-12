// extension/page-bridge.js
// Enkel brygga mellan peerrate.ai och extensionens service worker.
// Endast två funktioner:
// - ge sidan pending payload
// - markera affär som redan betygsatt

(function () {
  function isTrustedPeerRateMessage(data) {
    return !!(
      data &&
      typeof data === 'object' &&
      data.type &&
      String(data.type).startsWith('PEERRATE_')
    );
  }

  function safeSendRuntimeMessage(message, callback) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        if (typeof callback === 'function') {
          callback(response);
        }
      });
    } catch (err) {
      console.warn('[PeerRate extension] page-bridge sendMessage failed:', err);
      if (typeof callback === 'function') {
        callback({ ok: false, error: String(err?.message || err || 'unknown') });
      }
    }
  }

  function postBack(type, payload = {}) {
    try {
      window.postMessage(
        {
          type,
          payload,
        },
        window.location.origin
      );
    } catch (err) {
      console.warn('[PeerRate extension] page-bridge postBack failed:', err);
    }
  }

  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      if (!event.origin || !/^https:\/\/(www\.)?peerrate\.ai$/i.test(event.origin)) return;

      const data = event.data;
      if (!isTrustedPeerRateMessage(data)) return;

      if (data.type === 'PEERRATE_MARK_DEAL_RATED') {
        safeSendRuntimeMessage(
          {
            type: 'markDealRatedFromPage',
            payload: data.payload || {},
          },
          () => {}
        );
        return;
      }

      if (data.type === 'PEERRATE_REQUEST_PENDING_PAYLOAD') {
        safeSendRuntimeMessage(
          {
            type: 'getPendingPayloadForPage',
          },
          (response) => {
            postBack('PEERRATE_PENDING_PAYLOAD_RESPONSE', {
              ok: !!response?.ok,
              payload: response?.payload || null,
            });
          }
        );
        return;
      }

      if (data.type === 'PEERRATE_CLEAR_PENDING_PAYLOAD') {
        safeSendRuntimeMessage(
          {
            type: 'clearPendingPayloadForPage',
          },
          () => {}
        );
      }
    } catch (err) {
      console.warn('[PeerRate extension] page-bridge failed:', err);
    }
  });
})();
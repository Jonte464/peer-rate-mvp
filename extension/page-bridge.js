// extension/page-bridge.js
// Brygga mellan peerrate.ai-sidan och extensionens service worker.
// Tar emot window.postMessage från peerrate.ai och skickar vidare till extensionen.
//
// NYTT:
// - synkar inloggad PeerRate-identitet till extension storage
// - rensar identiteten vid logout
// - behåller markDealRated-bryggan

(function () {
  function isTrustedPeerRateMessage(data) {
    return !!(
      data &&
      typeof data === "object" &&
      data.type &&
      String(data.type).startsWith("PEERRATE_")
    );
  }

  function safeSendRuntimeMessage(message) {
    try {
      chrome.runtime.sendMessage(message, () => {
        void chrome.runtime.lastError;
      });
    } catch (err) {
      console.warn("[PeerRate extension] page-bridge sendMessage failed:", err);
    }
  }

  window.addEventListener("message", (event) => {
    try {
      if (event.source !== window) return;
      if (!event.origin || !/^https:\/\/(www\.)?peerrate\.ai$/i.test(event.origin)) return;

      const data = event.data;
      if (!isTrustedPeerRateMessage(data)) return;

      if (data.type === "PEERRATE_MARK_DEAL_RATED") {
        safeSendRuntimeMessage({
          type: "markDealRatedFromPage",
          payload: data.payload || {},
        });
        return;
      }

      if (data.type === "PEERRATE_SYNC_AUTH_IDENTITY") {
        safeSendRuntimeMessage({
          type: "syncAuthIdentityFromPage",
          payload: data.payload || {},
        });
        return;
      }

      if (data.type === "PEERRATE_CLEAR_AUTH_IDENTITY") {
        safeSendRuntimeMessage({
          type: "clearAuthIdentityFromPage",
        });
      }
    } catch (err) {
      console.warn("[PeerRate extension] page-bridge failed:", err);
    }
  });
})();
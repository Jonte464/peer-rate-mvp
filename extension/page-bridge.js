// extension/page-bridge.js
// Brygga mellan peerrate.ai-sidan och extensionens service worker.
// Tar emot window.postMessage från rate.html och skickar vidare till extensionen.

(function () {
  function isTrustedPeerRateMessage(data) {
    return !!(
      data &&
      typeof data === "object" &&
      data.type &&
      String(data.type).startsWith("PEERRATE_")
    );
  }

  window.addEventListener("message", (event) => {
    try {
      if (event.source !== window) return;
      if (!event.origin || !/^https:\/\/(www\.)?peerrate\.ai$/i.test(event.origin)) return;

      const data = event.data;
      if (!isTrustedPeerRateMessage(data)) return;

      if (data.type === "PEERRATE_MARK_DEAL_RATED") {
        chrome.runtime.sendMessage(
          {
            type: "markDealRatedFromPage",
            payload: data.payload || {},
          },
          () => {
            void chrome.runtime.lastError;
          }
        );
      }
    } catch (err) {
      console.warn("[PeerRate extension] page-bridge failed:", err);
    }
  });
})();
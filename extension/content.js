// extension/content.js
// MVP: Om sidan verkar handla om "avslutad/vunnen/såld" visar vi en flytande knapp.
// Klick öppnar PeerRate med queryparams (source + pageUrl).

(function () {
  const DEFAULTS = {
    peerrate_enabled: true
  };

  chrome.storage.sync.get(DEFAULTS, (data) => {
    if (!data.peerrate_enabled) return;

    // Enkla "signaler" (MVP)
    // OBS: Detta är medvetet simpelt och kan förbättras senare.
    const text = (document.body ? document.body.innerText : "").toLowerCase();
    const url = location.href.toLowerCase();

    const looksLikeRelevantPage =
      url.includes("tradera") &&
      (
        url.includes("item") ||            // ofta objekt/annons-sidor
        url.includes("auction") ||
        url.includes("mina") ||
        url.includes("my")
      );

    const hasEndSignals =
      text.includes("avslutad") ||
      text.includes("såld") ||
      text.includes("vunnen") ||
      text.includes("du vann") ||
      text.includes("köpt") ||
      text.includes("order") ||
      text.includes("betalning");

    if (!looksLikeRelevantPage || !hasEndSignals) return;

    injectButton();
  });

  function injectButton() {
    if (document.getElementById("peerrate-float-btn")) return;

    const btn = document.createElement("button");
    btn.id = "peerrate-float-btn";
    btn.type = "button";
    btn.textContent = "Betygsätt med PeerRate";
    btn.setAttribute("aria-label", "Betygsätt med PeerRate");

    // Enkel stil – flytande knapp nere till höger
    Object.assign(btn.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "999999",
      padding: "12px 14px",
      borderRadius: "14px",
      border: "1px solid rgba(0,0,0,0.15)",
      background: "#ffffff",
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600"
    });

    btn.addEventListener("click", () => {
      const pageUrl = encodeURIComponent(location.href);

      // ✅ Byt denna URL om din riktiga rating-sida är t.ex. /#rate
      const PEERRATE_RATE_URL_BASE = "https://peerrate.ai/#rate";

      const target = `${PEERRATE_RATE_URL_BASE}?source=tradera&pageUrl=${pageUrl}`;

      chrome.runtime.sendMessage({ type: "openRating", url: target });
    });

    document.documentElement.appendChild(btn);
  }
})();

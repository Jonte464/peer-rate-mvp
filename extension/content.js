// extension/content.js
// Robustare MVP: försöker flera gånger + lyssnar på ändringar på sidan (Tradera laddar ofta dynamiskt).

(function () {
  const DEFAULTS = { peerrate_enabled: true };

  chrome.storage.sync.get(DEFAULTS, (data) => {
    if (!data.peerrate_enabled) return;

    // 1) Kör direkt + flera gånger (ifall Tradera laddar sent)
    let tries = 0;
    const maxTries = 20; // ~20 sek om vi kör varje sekund

    const tick = () => {
      tries++;
      if (maybeShowButton()) return;
      if (tries >= maxTries) clearInterval(timer);
    };

    tick();
    const timer = setInterval(tick, 1000);

    // 2) Lyssna på förändringar i sidan (SPA/dynamiskt innehåll)
    const obs = new MutationObserver(() => {
      maybeShowButton();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });

  function maybeShowButton() {
    if (document.getElementById("peerrate-float-btn")) return true;

    const url = location.href.toLowerCase();

    // Bara Tradera
    const onTradera =
      url.startsWith("https://www.tradera.com/") ||
      url.startsWith("https://www.tradera.se/");

    if (!onTradera) return false;

    const text = (document.body ? document.body.innerText : "").toLowerCase();

    // URL-signaler (vi breddar lite)
    const looksLikeRelevantPage =
      url.includes("/item/") ||          // annons/objekt
      url.includes("/my/") ||            // "mina" sidor (köp/ordrar)
      url.includes("order") ||           // order-sidor
      url.includes("purchases") ||
      url.includes("sales");

    // Text-signaler (typ det du visar i bild: "Avslutad", "du vann", etc)
    const hasEndSignals =
      text.includes("avslutad") ||
      text.includes("såld") ||
      text.includes("vunnen") ||
      text.includes("du vann") ||
      text.includes("grattis") ||
      text.includes("orderinformation") ||
      text.includes("betald") ||
      text.includes("skickad") ||
      text.includes("lämna omdöme");

    if (!looksLikeRelevantPage || !hasEndSignals) return false;

    injectButton();
    return true;
  }

  function injectButton() {
    const btn = document.createElement("button");
    btn.id = "peerrate-float-btn";
    btn.type = "button";
    btn.textContent = "Betygsätt med PeerRate";

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

      // Din riktiga rate-URL:
      const PEERRATE_RATE_URL_BASE = "https://peerrate.ai/#rate";

      // OBS: Om #rate inte tar queryparams snyggt kan vi ändra strategi sen.
      const target = `${PEERRATE_RATE_URL_BASE}?source=tradera&pageUrl=${pageUrl}`;

      chrome.runtime.sendMessage({ type: "openRating", url: target });
    });

    document.documentElement.appendChild(btn);
  }
})();

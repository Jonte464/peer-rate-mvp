// extension/content.js
// PeerRate – Tradera trigger (MVP)
// Visar en mörkblå "Betygsätt med PeerRate"-knapp på relevanta Tradera-sidor

(function () {
  const DEFAULTS = { peerrate_enabled: true };

  chrome.storage.sync.get(DEFAULTS, (data) => {
    if (!data.peerrate_enabled) return;

    let tries = 0;
    const maxTries = 20;

    const tick = () => {
      tries++;
      if (maybeShowButton()) return;
      if (tries >= maxTries) clearInterval(timer);
    };

    tick();
    const timer = setInterval(tick, 1000);

    const obs = new MutationObserver(() => {
      maybeShowButton();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });

  function maybeShowButton() {
    if (document.getElementById("peerrate-float-btn")) return true;

    const url = location.href.toLowerCase();
    if (!url.includes("tradera")) return false;

    const text = (document.body?.innerText || "").toLowerCase();

    const looksRelevant =
      url.includes("/item/") ||
      url.includes("/my/") ||
      url.includes("order") ||
      url.includes("purchase");

    const hasSignals =
      text.includes("avslutad") ||
      text.includes("såld") ||
      text.includes("vunnen") ||
      text.includes("du vann") ||
      text.includes("orderinformation") ||
      text.includes("betald") ||
      text.includes("skickad") ||
      text.includes("lämna omdöme");

    if (!looksRelevant || !hasSignals) return false;

    injectButton();
    return true;
  }

  function injectButton() {
    const btn = document.createElement("button");
    btn.id = "peerrate-float-btn";
    btn.type = "button";
    btn.textContent = "Betygsätt med PeerRate";

    /* ====== PEERRATE-STYLING ====== */
    Object.assign(btn.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      zIndex: "999999",

      background: "linear-gradient(135deg, #0b1f3b, #132f55)",
      color: "#ffffff",

      padding: "14px 18px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.15)",

      fontSize: "14px",
      fontWeight: "600",
      letterSpacing: "0.2px",

      cursor: "pointer",

      boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
      backdropFilter: "blur(6px)"
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-1px)";
      btn.style.boxShadow = "0 20px 50px rgba(0,0,0,0.6)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 16px 40px rgba(0,0,0,0.45)";
    });

    btn.addEventListener("click", () => {
      const pageUrl = encodeURIComponent(location.href);
      const target = `https://peerrate.ai/#rate?source=tradera&pageUrl=${pageUrl}`;
      chrome.runtime.sendMessage({ type: "openRating", url: target });
    });

    document.documentElement.appendChild(btn);
  }
})();

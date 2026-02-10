// extension/content.js
// PeerRate – Tradera trigger (MVP)
// Visar "Betygsätt med PeerRate"-knapp och skickar prefill (email m.m.) från Tradera order-sida

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
    if (!url.includes("tradera.com")) return false;

    // Din ordervy: /my/order/...
    if (!url.includes("/my/order/")) return false;

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
      const pageUrl = location.href;

      const extracted = extractCounterpartyFromOrderPage();
      const orderInfo = extractOrderInfo();

      // HÅRDKRAV: om vi inte hittar email så ska vi inte låta användaren gissa
      if (!extracted.email) {
        alert("PeerRate: Kunde inte hitta motpartens e-post på sidan. Öppna en order där e-post visas.");
        return;
      }

      const payload = {
        source: "Tradera",
        pageUrl,
        subjectEmail: extracted.email.toLowerCase(),
        counterparty: {
          email: extracted.email.toLowerCase(),
          name: extracted.name || undefined,
          phone: extracted.phone || undefined,
          addressStreet: extracted.addressStreet || undefined,
          addressZip: extracted.addressZip || undefined,
          addressCity: extracted.addressCity || undefined,
          country: extracted.country || "SE",
          platform: "TRADERA",
          platformUsername: extracted.username || undefined,
          pageUrl,
          orderId: orderInfo.orderId || undefined,
          itemId: orderInfo.itemId || undefined,
          amountSek: orderInfo.amountSek || undefined,
          title: orderInfo.title || undefined,
        },
        proofRef: orderInfo.orderId || undefined,
      };

      const pr = encodeURIComponent(btoa(JSON.stringify(payload)));
      const target =
        `https://peerrate.ai/rate.html?source=tradera&pageUrl=${encodeURIComponent(pageUrl)}&pr=${pr}`;

      chrome.runtime.sendMessage({ type: "openRating", url: target });
    });

    document.documentElement.appendChild(btn);
  }

  function extractCounterpartyFromOrderPage() {
    // e-post via mailto: är mest robust
    const mailEl = document.querySelector('a[href^="mailto:"]');
    const email = mailEl ? (mailEl.getAttribute("href") || "").replace(/^mailto:/i, "").trim() : null;

    // tel via tel:
    const telEl = document.querySelector('a[href^="tel:"]');
    const phone = telEl ? (telEl.textContent || "").trim() : null;

    // ofta finns “alias” som rubrik i kontakt-kortet (t.ex. GalopperandeLoppan)
    // heuristik: ta största “rubrik-liknande” texten nära mailto
    let username = null;
    let name = null;
    let addressStreet = null;
    let addressZip = null;
    let addressCity = null;
    let country = null;

    if (mailEl) {
      const container = mailEl.closest('div') || mailEl.parentElement;
      const blockText = (container?.innerText || "").split("\n").map(s => s.trim()).filter(Boolean);

      // Försök hitta en rad som ser ut som alias (utan mellanslag) nära toppen
      for (const line of blockText.slice(0, 6)) {
        if (line.includes("@")) continue;
        if (line.length < 3 || line.length > 30) continue;
        if (line.includes(" ")) continue;
        if (/^\d+$/.test(line)) continue;
        username = line;
        break;
      }

      // Namn tenderar vara en rad med mellanslag, inte email/tel
      for (const line of blockText) {
        if (line.includes("@")) continue;
        if (phone && line.includes(phone)) continue;
        if (line.length < 3 || line.length > 60) continue;
        if (/\d{3,}/.test(line) && !line.includes(" ")) continue;
        if (line.includes("Sverige") || line.toLowerCase() === "se") continue;

        // ganska bra kandidat: minst två ord
        if (line.split(" ").length >= 2) {
          name = line;
          break;
        }
      }

      // Adressrader: heuristiskt
      // street: innehåller ofta siffror + bokstäver
      // zip/city: 5 siffror + stad
      for (const line of blockText) {
        if (!addressStreet && /[A-Za-zÅÄÖåäö].*\d|\d.*[A-Za-zÅÄÖåäö]/.test(line) && !line.includes("@")) {
          // typ "Tröskvägen 26"
          addressStreet = line;
          continue;
        }
        if (!addressZip && /\b\d{5}\b/.test(line)) {
          addressZip = (line.match(/\b\d{5}\b/) || [null])[0];
          addressCity = line.replace(addressZip, "").trim() || addressCity;
          continue;
        }
        if (!country && /sverige/i.test(line)) {
          country = "SE";
        }
      }
    }

    return { email, phone, username, name, addressStreet, addressZip, addressCity, country };
  }

  function extractOrderInfo() {
    const t = (document.body?.innerText || "");

    const orderMatch = t.match(/Ordernr\.\s*([0-9 ]{6,})/i);
    const orderId = orderMatch ? orderMatch[1].trim().replace(/\s+/g, " ") : null;

    const itemMatch = t.match(/Objektnr\s*([0-9 ]{6,})/i);
    const itemId = itemMatch ? itemMatch[1].trim().replace(/\s+/g, " ") : null;

    // Titel: ofta raden efter objektnr
    let title = null;
    if (itemMatch) {
      const idx = t.indexOf(itemMatch[0]);
      if (idx !== -1) {
        const after = t.slice(idx + itemMatch[0].length, idx + itemMatch[0].length + 200);
        const lines = after.split("\n").map(s => s.trim()).filter(Boolean);
        if (lines[0] && lines[0].length > 3) title = lines[0];
      }
    }

    // Belopp (SEK): leta nära "Total"
    let amountSek = null;
    const totalIdx = t.toLowerCase().indexOf("total");
    if (totalIdx !== -1) {
      const windowText = t.slice(totalIdx, totalIdx + 300);
      const m = windowText.match(/([0-9]{1,6})\s*kr/i);
      if (m) amountSek = Number(m[1]);
    }

    return { orderId, itemId, title, amountSek };
  }
})();

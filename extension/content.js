// extension/content.js
// PeerRate – Tradera trigger (MVP)
// Visar flytande knapp på Tradera ordervy och skickar verifierad payload till PeerRate hub.

(function () {
  const DEFAULTS = { peerrate_enabled: true };

  chrome.storage.sync.get(DEFAULTS, (data) => {
    if (!data.peerrate_enabled) return;

    let tries = 0;
    const maxTries = 25;

    const tick = () => {
      tries++;
      if (maybeShowButton()) return;
      if (tries >= maxTries) clearInterval(timer);
    };

    tick();
    const timer = setInterval(tick, 900);

    const obs = new MutationObserver(() => {
      maybeShowButton();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });

  function maybeShowButton() {
    if (document.getElementById("peerrate-float-btn")) return true;

    const url = location.href.toLowerCase();
    if (!url.includes("tradera.")) return false;

    // Tradera ordervy: /my/order/...
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
      fontWeight: "700",
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

      const cp = extractCounterpartyFromOrderPage();
      const order = extractOrderInfo();

      const hasCounterparty = !!(cp.email || cp.username);
      if (!hasCounterparty) {
        alert("PeerRate: Kunde inte hitta motpart (email/alias) på sidan. Öppna en order där kontaktinfo syns.");
        return;
      }

      const proofRef = order.orderId || pageUrl;

      const payload = {
        v: 1,
        source: "tradera",
        pageUrl,
        proofRef,
        deal: {
          platform: "TRADERA",
          orderId: order.orderId || null,
          itemId: order.itemId || null,
          title: order.title || null,
          amount: order.amount != null ? order.amount : null,
          currency: order.currency || (order.amount != null ? "SEK" : null),
          date: order.dateISO || null,
          counterparty: {
            email: cp.email ? cp.email.toLowerCase() : null,
            username: cp.username || null,
            name: cp.name || null,
            phone: cp.phone || null
          }
        }
      };

      const pr = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
      const target =
        `https://peerrate.ai/rate.html?source=tradera&pageUrl=${encodeURIComponent(pageUrl)}&proofRef=${encodeURIComponent(proofRef)}&pr=${pr}`;

      chrome.runtime.sendMessage({ type: "openRating", url: target });
    });

    document.documentElement.appendChild(btn);
  }

  function extractCounterpartyFromOrderPage() {
    // email via mailto:
    const mailEl = document.querySelector('a[href^="mailto:"]');
    const email = mailEl ? (mailEl.getAttribute("href") || "").replace(/^mailto:/i, "").trim() : null;

    // phone via tel: (om finns)
    const telEl = document.querySelector('a[href^="tel:"]');
    let phone = null;
    if (telEl) {
      phone = (telEl.textContent || "").trim();
    }

    let username = null;
    let name = null;

    // Heuristik: text nära mailto
    if (mailEl) {
      const container = mailEl.closest("div") || mailEl.parentElement;
      const blockText = (container?.innerText || "")
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      // Username: rad utan mellanslag nära toppen
      for (const line of blockText.slice(0, 10)) {
        if (line.includes("@")) continue;
        if (line.length < 3 || line.length > 30) continue;
        if (line.includes(" ")) continue;
        if (/^\d+$/.test(line)) continue;
        username = line;
        break;
      }

      // Name: minst två ord
      for (const line of blockText) {
        if (line.includes("@")) continue;
        if (line.length < 3 || line.length > 60) continue;
        if (line.split(" ").length >= 2) {
          name = line;
          break;
        }
      }

      // Om telefon inte hittades via tel:, försök regex i samma block
      if (!phone) {
        const merged = blockText.join(" ");
        phone = extractPhoneFromText(merged);
      }
    }

    // Fallback: telefon kan vara synlig på sidan men ej i kontaktkortet
    if (!phone) {
      phone = extractPhoneFromText(document.body?.innerText || "");
    }

    return { email, username, name, phone };
  }

  function extractOrderInfo() {
    const t = (document.body?.innerText || "");

    // Ordernr: "Ordernr. 145 376 613"
    const orderMatch = t.match(/Ordernr\.\s*([0-9 ]{4,})/i);
    const orderId = orderMatch ? orderMatch[1].trim().replace(/\s+/g, "") : null;

    // Objektnr: "Objektnr 707 212 678"
    const itemMatch = t.match(/Objektnr\s*([0-9 ]{4,})/i);
    const itemId = itemMatch ? itemMatch[1].trim().replace(/\s+/g, "") : null;

    // Titel: ofta nära "Objektnr"
    let title = null;
    if (itemMatch) {
      const idx = t.indexOf(itemMatch[0]);
      if (idx !== -1) {
        const after = t.slice(idx + itemMatch[0].length, idx + itemMatch[0].length + 260);
        const lines = after.split("\n").map(s => s.trim()).filter(Boolean);
        if (lines[0] && lines[0].length > 2) title = lines[0];
      }
    }

    // Belopp: stötta Total/Totalt/Summa + "kr"
    const amount = extractAmountSEK(t);

    // Datum: stötta
    // - 2026-02-10
    // - 10/02/2026
    // - 14 dec 20:03 (utan år)
    const dateISO = extractDateISO(t);

    return { orderId, itemId, title, amount, currency: amount != null ? "SEK" : null, dateISO };
  }

  function extractAmountSEK(text) {
    const lower = (text || "").toLowerCase();

    // Försök hitta block nära "totalt" / "total" / "summa"
    const keys = ["totalt", "total", "summa", "att betala"];
    for (const key of keys) {
      const idx = lower.indexOf(key);
      if (idx !== -1) {
        const windowText = text.slice(idx, idx + 500);
        // matcha "47 kr" eller "1 234 kr"
        const m = windowText.match(/([0-9]{1,3}(?:[ \u00A0][0-9]{3})*|[0-9]{1,7})\s*kr\b/i);
        if (m) {
          const num = m[1].replace(/[ \u00A0]/g, "");
          const n = Number(num);
          if (!Number.isNaN(n)) return n;
        }
      }
    }

    // Fallback: ta sista "X kr" på sidan (ofta totalen sist)
    const all = Array.from(text.matchAll(/([0-9]{1,3}(?:[ \u00A0][0-9]{3})*|[0-9]{1,7})\s*kr\b/gi));
    if (all.length) {
      const last = all[all.length - 1];
      const num = (last[1] || "").replace(/[ \u00A0]/g, "");
      const n = Number(num);
      if (!Number.isNaN(n)) return n;
    }

    return null;
  }

  function extractDateISO(text) {
    const t = text || "";

    // ISO: 2026-02-10
    const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    // 10/02/2026
    const se = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (se) {
      const dd = String(se[1]).padStart(2, "0");
      const mm = String(se[2]).padStart(2, "0");
      return `${se[3]}-${mm}-${dd}`;
    }

    // Svensk månad: 14 dec 20:03 eller 14 dec
    const m = t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\b(?:\s+(20\d{2}))?/i);
    if (m) {
      const dd = String(m[1]).padStart(2, "0");
      const mon = m[2].toLowerCase();
      const map = { jan:"01", feb:"02", mar:"03", apr:"04", maj:"05", jun:"06", jul:"07", aug:"08", sep:"09", okt:"10", nov:"11", dec:"12" };
      const mm = map[mon] || "01";
      const yyyy = m[3] ? String(m[3]) : String(new Date().getFullYear());
      return `${yyyy}-${mm}-${dd}`;
    }

    return null;
  }

  function extractPhoneFromText(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();

    // Matcha typ: +46 72-229 00 97 / +46 72 229 00 97 / 072-2290097
    const m =
      t.match(/(\+46\s?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,3})/) ||
      t.match(/\b(0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,3})\b/);

    return m ? m[1].trim() : null;
  }
})();

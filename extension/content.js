// extension/content.js
// PeerRate – Tradera trigger (MVP)
// Visar endast knapp om backend EXPLICIT säger att affären kan betygsättas.
// Konservativ strategi:
// - okänt fel / timeout / otydligt svar => visa INTE knapp
// - alreadyRated => visa INTE knapp
// - canRate === true => visa knapp
//
// NYTT:
// - försöker läsa aktivt Tradera-konto från sidan
// - skickar activeMarketplaceIdentity till backend
// - om aktiv identitet inte kan läsas blir det ingen knapp

(function () {
  const DEFAULTS = { peerrate_enabled: true };
  const BTN_ID = "peerrate-float-btn";

  let evaluateTimer = null;
  let isEvaluating = false;
  let latestPayload = null;

  // kort minnescache för aktuell sida
  let lastStatus = {
    key: "",
    at: 0,
    ok: false,
    alreadyRated: false,
    canRate: false,
  };

  chrome.storage.sync.get(DEFAULTS, (data) => {
    if (!data.peerrate_enabled) return;
    start();
  });

  function start() {
    scheduleEvaluate(0);

    let tries = 0;
    const maxTries = 25;

    const timer = setInterval(() => {
      tries += 1;
      scheduleEvaluate(0);
      if (tries >= maxTries) clearInterval(timer);
    }, 900);

    const obs = new MutationObserver(() => {
      scheduleEvaluate(250);
    });

    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("pageshow", () => scheduleEvaluate(0));
    window.addEventListener("focus", () => scheduleEvaluate(0));
  }

  function scheduleEvaluate(delayMs = 200) {
    if (evaluateTimer) clearTimeout(evaluateTimer);
    evaluateTimer = setTimeout(() => {
      void evaluatePage();
    }, delayMs);
  }

  function normalizeText(v) {
    return String(v || "").trim();
  }

  function normalizeLower(v) {
    return normalizeText(v).toLowerCase();
  }

  function buildLocalKey(payload) {
    const source = normalizeLower(payload?.source || payload?.deal?.platform || "");
    const proofRef = normalizeLower(
      payload?.proofRef ||
      payload?.deal?.orderId ||
      payload?.pageUrl ||
      ""
    );

    if (!source || !proofRef) return "";
    return `${source}|${proofRef}`;
  }

  async function evaluatePage() {
    if (isEvaluating) return;
    isEvaluating = true;

    try {
      const payload = extractRatingPayloadFromPage();

      if (!payload) {
        latestPayload = null;
        removeButton();
        return;
      }

      latestPayload = payload;

      const key = buildLocalKey(payload);
      const now = Date.now();

      let status = null;
      if (
        key &&
        lastStatus.key === key &&
        (now - lastStatus.at) < 10000
      ) {
        status = lastStatus;
      } else {
        status = await sendMessageAsync({
          type: "checkDealStatus",
          payload,
        });

        lastStatus = {
          key,
          at: now,
          ok: !!status?.ok,
          alreadyRated: !!status?.alreadyRated,
          canRate: status?.canRate === true,
        };
      }

      // ✅ HÅRD REGEL:
      // Visa bara knapp om backend uttryckligen säger canRate === true
      if (!status || status.ok !== true || status.canRate !== true || status.alreadyRated === true) {
        removeButton();
        return;
      }

      injectOrUpdateButton(payload);
    } catch (err) {
      console.warn("[PeerRate extension] evaluatePage failed:", err);
      removeButton();
    } finally {
      isEvaluating = false;
    }
  }

  function sendMessageAsync(message) {
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
          resolve(response);
        });
      } catch (err) {
        resolve({
          ok: false,
          error: String(err?.message || err || "Unknown error"),
        });
      }
    });
  }

  function isRelevantTraderaOrderPage() {
    const url = location.href.toLowerCase();
    if (!url.includes("tradera.")) return false;
    if (!url.includes("/my/order/")) return false;
    return true;
  }

  function extractRatingPayloadFromPage() {
    if (!isRelevantTraderaOrderPage()) return null;

    const pageUrl = location.href;
    const cp = extractCounterpartyFromOrderPage();
    const order = extractOrderInfo();
    const activeIdentity = extractActiveTraderaIdentity(cp);

    const hasCounterparty = !!(cp.email || cp.username);
    const proofRef = order.orderId || pageUrl;

    if (!hasCounterparty) return null;
    if (!proofRef) return null;

    // Konservativt:
    // Om vi inte kan läsa aktivt konto från sidan skickar vi ändå payload till backend,
    // men backend kommer att blockera canRate för extension-kanalen.
    return {
      v: 2,
      source: "tradera",
      pageUrl,
      proofRef,
      activeMarketplaceIdentity: activeIdentity,
      deal: {
        platform: "TRADERA",
        orderId: order.orderId || null,
        itemId: order.itemId || null,
        title: order.title || null,
        amount: order.amount != null ? order.amount : null,
        currency: order.currency || (order.amount != null ? "SEK" : null),
        date: order.dateISO || null,
        dateISO: order.dateISO || null,
        pageUrl,
        counterparty: {
          email: cp.email ? cp.email.toLowerCase() : null,
          username: cp.username || null,
          name: cp.name || null,
          phone: cp.phone || null
        }
      },
      counterparty: {
        email: cp.email ? cp.email.toLowerCase() : null,
        username: cp.username || null,
        name: cp.name || null,
        phone: cp.phone || null,
        platform: "TRADERA",
        pageUrl,
        orderId: order.orderId || null,
        itemId: order.itemId || null,
        title: order.title || null,
        amountSek: order.amount != null ? order.amount : null,
      }
    };
  }

  function injectOrUpdateButton(payload) {
    let btn = document.getElementById(BTN_ID);

    if (!btn) {
      btn = document.createElement("button");
      btn.id = BTN_ID;
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

      btn.addEventListener("click", async () => {
        const activePayload = latestPayload || payload;
        if (!activePayload) return;

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = "Kontrollerar affären...";

        try {
          const result = await sendMessageAsync({
            type: "openRatingForPayload",
            payload: activePayload,
          });

          // Öppna bara om backend uttryckligen godkände
          if (result?.ok === true && result?.opened === true && result?.canRate === true) {
            btn.disabled = false;
            btn.textContent = originalText;
            return;
          }

          removeButton();

          if (result?.alreadyRated === true) {
            alert("Den här affären har redan betygsatts i PeerRate.");
            return;
          }

          console.warn("[PeerRate extension] Rating flow blocked because canRate was not explicitly true.", result);
        } catch (err) {
          console.warn("[PeerRate extension] click handler failed:", err);
          removeButton();
        } finally {
          const liveBtn = document.getElementById(BTN_ID);
          if (liveBtn) {
            liveBtn.disabled = false;
            liveBtn.textContent = originalText;
          }
        }
      });

      document.documentElement.appendChild(btn);
    }

    btn.dataset.proofRef = payload?.proofRef || "";
    btn.dataset.source = payload?.source || "";
  }

  function removeButton() {
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.remove();
  }

  function extractCounterpartyFromOrderPage() {
    const mailEl = document.querySelector('a[href^="mailto:"]');
    const email = mailEl ? (mailEl.getAttribute("href") || "").replace(/^mailto:/i, "").trim() : null;

    const telEl = document.querySelector('a[href^="tel:"]');
    let phone = null;
    if (telEl) {
      phone = (telEl.textContent || "").trim();
    }

    let username = null;
    let name = null;

    if (mailEl) {
      const container = mailEl.closest("div") || mailEl.parentElement;
      const blockText = (container?.innerText || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const line of blockText.slice(0, 10)) {
        if (line.includes("@")) continue;
        if (line.length < 3 || line.length > 30) continue;
        if (line.includes(" ")) continue;
        if (/^\d+$/.test(line)) continue;
        username = line;
        break;
      }

      for (const line of blockText) {
        if (line.includes("@")) continue;
        if (line.length < 3 || line.length > 60) continue;
        if (line.split(" ").length >= 2) {
          name = line;
          break;
        }
      }

      if (!phone) {
        const merged = blockText.join(" ");
        phone = extractPhoneFromText(merged);
      }
    }

    if (!phone) {
      phone = extractPhoneFromText(document.body?.innerText || "");
    }

    return { email, username, name, phone };
  }

  function extractOrderInfo() {
    const t = (document.body?.innerText || "");

    const orderMatch = t.match(/Ordernr\.\s*([0-9 ]{4,})/i);
    const orderId = orderMatch ? orderMatch[1].trim().replace(/\s+/g, "") : null;

    const itemMatch = t.match(/Objektnr\s*([0-9 ]{4,})/i);
    const itemId = itemMatch ? itemMatch[1].trim().replace(/\s+/g, "") : null;

    let title = null;
    if (itemMatch) {
      const idx = t.indexOf(itemMatch[0]);
      if (idx !== -1) {
        const after = t.slice(idx + itemMatch[0].length, idx + itemMatch[0].length + 260);
        const lines = after.split("\n").map((s) => s.trim()).filter(Boolean);
        if (lines[0] && lines[0].length > 2) title = lines[0];
      }
    }

    const amount = extractAmountSEK(t);
    const dateISO = extractDateISO(t);

    return { orderId, itemId, title, amount, currency: amount != null ? "SEK" : null, dateISO };
  }

  function extractActiveTraderaIdentity(counterparty) {
    const counterpartyUsername = normalizeLower(counterparty?.username || "");
    const counterpartyEmail = normalizeLower(counterparty?.email || "");

    const stopWords = new Set([
      "logga in",
      "logga ut",
      "konto",
      "konton",
      "mina sidor",
      "min sida",
      "mina köp",
      "mina salda",
      "mina sålda",
      "köp",
      "sälj",
      "salj",
      "meddelanden",
      "aviseringar",
      "notiser",
      "hjälp",
      "hjalp",
      "support",
      "tradera",
      "meny",
      "menu",
      "spara",
      "redigera",
      "profil",
      "account",
      "my account",
      "settings",
    ]);

    function isLikelyAlias(text) {
      const value = normalizeText(text);
      const lower = value.toLowerCase();

      if (!value) return false;
      if (value.length < 3 || value.length > 40) return false;
      if (value.includes("@")) return false;
      if (/^\d+$/.test(value)) return false;
      if (value.split(/\s+/).length > 3) return false;
      if (stopWords.has(lower)) return false;

      return true;
    }

    function extractAliasCandidatesFromHref(href) {
      try {
        if (!href) return [];
        const url = new URL(href, location.origin);
        const parts = url.pathname.split("/").map((p) => p.trim()).filter(Boolean);
        const out = [];

        for (let i = 0; i < parts.length; i += 1) {
          const part = decodeURIComponent(parts[i] || "");
          const lower = part.toLowerCase();

          if (["profile", "member", "user", "konto", "account", "seller", "buyer"].includes(lower)) {
            const next = decodeURIComponent(parts[i + 1] || "");
            if (isLikelyAlias(next)) out.push(next);
          }
        }

        return out;
      } catch {
        return [];
      }
    }

    function collectAccountTexts() {
      const selectors = [
        "header a",
        "header button",
        "header [title]",
        "nav a",
        "nav button",
        "[aria-label*='konto' i]",
        "[aria-label*='account' i]",
        "[data-testid*='account' i]",
        "[class*='account'] a",
        "[class*='profile'] a",
      ];

      const seen = new Set();
      const out = [];

      for (const selector of selectors) {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          const texts = [
            node.textContent || "",
            node.getAttribute?.("aria-label") || "",
            node.getAttribute?.("title") || "",
          ];

          for (const raw of texts) {
            const text = normalizeText(raw);
            if (!text) continue;
            if (seen.has(text)) continue;
            seen.add(text);
            out.push(text);
          }

          const href = node.getAttribute?.("href") || "";
          const hrefCandidates = extractAliasCandidatesFromHref(href);
          for (const candidate of hrefCandidates) {
            if (!candidate) continue;
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            out.push(candidate);
          }
        }
      }

      return out;
    }

    function collectEmailsFromAccountAreas() {
      const selectors = [
        "header",
        "nav",
        "[aria-label*='konto' i]",
        "[aria-label*='account' i]",
        "[data-testid*='account' i]",
        "[class*='account']",
        "[class*='profile']",
      ];

      const emails = new Set();

      for (const selector of selectors) {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          const text = normalizeText(node.innerText || "");
          if (!text) continue;

          const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
          for (const match of matches) {
            const email = normalizeLower(match);
            if (email) emails.add(email);
          }
        }
      }

      return Array.from(emails);
    }

    const rawTexts = collectAccountTexts();

    const aliasCandidates = rawTexts
      .map((text) => normalizeText(text))
      .filter((text) => isLikelyAlias(text))
      .filter((text) => normalizeLower(text) !== counterpartyUsername)
      .filter((text) => normalizeLower(text) !== counterpartyEmail);

    const emailCandidates = collectEmailsFromAccountAreas()
      .filter((email) => email !== counterpartyEmail);

    const username = aliasCandidates[0] || null;
    const email = emailCandidates[0] || null;

    if (!username && !email) {
      return null;
    }

    return {
      platform: "TRADERA",
      username,
      email,
      confidence: username || email ? "heuristic" : "none",
    };
  }

  function extractAmountSEK(text) {
    const lower = (text || "").toLowerCase();

    const keys = ["totalt", "total", "summa", "att betala"];
    for (const key of keys) {
      const idx = lower.indexOf(key);
      if (idx !== -1) {
        const windowText = text.slice(idx, idx + 500);
        const m = windowText.match(/([0-9]{1,3}(?:[ \u00A0][0-9]{3})*|[0-9]{1,7})\s*kr\b/i);
        if (m) {
          const num = m[1].replace(/[ \u00A0]/g, "");
          const n = Number(num);
          if (!Number.isNaN(n)) return n;
        }
      }
    }

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

    const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const se = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (se) {
      const dd = String(se[1]).padStart(2, "0");
      const mm = String(se[2]).padStart(2, "0");
      return `${se[3]}-${mm}-${dd}`;
    }

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

    const m =
      t.match(/(\+46\s?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,3})/) ||
      t.match(/\b(0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,3})\b/);

    return m ? m[1].trim() : null;
  }
})();
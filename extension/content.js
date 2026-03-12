// extension/content.js
// PeerRate – Tradera trigger (basic reset)
// Enkel strategi:
// - hitta relevant Tradera order-sida
// - extrahera så mycket som möjligt direkt från sidans synliga innehåll
// - fråga backend om affären får betygsättas
// - visa knapp om canRate === true
// - inget identitetsmatchningslager i content-script

(function () {
  const DEFAULTS = { peerrate_enabled: true };
  const BTN_ID = 'peerrate-float-btn';

  let evaluateTimer = null;
  let isEvaluating = false;
  let latestPayload = null;

  let lastStatus = {
    key: '',
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

    window.addEventListener('pageshow', () => scheduleEvaluate(0));
    window.addEventListener('focus', () => scheduleEvaluate(0));
  }

  function scheduleEvaluate(delayMs = 200) {
    if (evaluateTimer) clearTimeout(evaluateTimer);
    evaluateTimer = setTimeout(() => {
      void evaluatePage();
    }, delayMs);
  }

  function normalizeText(v) {
    return String(v || '').trim();
  }

  function normalizeLower(v) {
    return normalizeText(v).toLowerCase();
  }

  function buildLocalKey(payload) {
    const source = normalizeLower(payload?.source || payload?.deal?.platform || '');
    const proofRef = normalizeLower(
      payload?.proofRef ||
      payload?.deal?.orderId ||
      payload?.pageUrl ||
      ''
    );

    if (!source || !proofRef) return '';
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
      if (key && lastStatus.key === key && (now - lastStatus.at) < 10000) {
        status = lastStatus;
      } else {
        status = await sendMessageAsync({
          type: 'checkDealStatus',
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

      if (!status || status.ok !== true || status.canRate !== true || status.alreadyRated === true) {
        removeButton();
        return;
      }

      injectOrUpdateButton(payload);
    } catch (err) {
      console.warn('[PeerRate extension] evaluatePage failed:', err);
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
          error: String(err?.message || err || 'Unknown error'),
        });
      }
    });
  }

  function isRelevantTraderaOrderPage() {
    const url = location.href.toLowerCase();
    if (!url.includes('tradera.')) return false;
    if (!url.includes('/my/order/')) return false;
    return true;
  }

  function extractRatingPayloadFromPage() {
    if (!isRelevantTraderaOrderPage()) return null;

    const pageUrl = location.href;
    const cp = extractCounterpartyFromOrderPage();
    const order = extractOrderInfo();

    const hasCounterparty = !!(cp.email || cp.name || cp.phone || cp.addressStreet || cp.addressCity);
    const proofRef = order.orderId || pageUrl;

    if (!proofRef) return null;

    return {
      v: 2,
      source: 'tradera',
      pageUrl,
      proofRef,
      deal: {
        platform: 'TRADERA',
        orderId: order.orderId || null,
        itemId: order.itemId || null,
        title: order.title || null,
        amount: order.amount != null ? order.amount : null,
        currency: order.currency || (order.amount != null ? 'SEK' : null),
        date: order.dateISO || null,
        dateISO: order.dateISO || null,
        pageUrl,
        counterparty: {
          email: cp.email ? cp.email.toLowerCase() : null,
          name: cp.name || null,
          phone: cp.phone || null,
          addressStreet: cp.addressStreet || null,
          addressZip: cp.addressZip || null,
          addressCity: cp.addressCity || null,
          country: cp.country || null,
        }
      },
      counterparty: {
        email: cp.email ? cp.email.toLowerCase() : null,
        name: cp.name || null,
        phone: cp.phone || null,
        addressStreet: cp.addressStreet || null,
        addressZip: cp.addressZip || null,
        addressCity: cp.addressCity || null,
        country: cp.country || null,
        platform: 'TRADERA',
        pageUrl,
        orderId: order.orderId || null,
        itemId: order.itemId || null,
        title: order.title || null,
        amountSek: order.amount != null ? order.amount : null,
      },
      // fallback för frontend om e-post saknas
      subjectEmail: cp.email ? cp.email.toLowerCase() : '',
    };
  }

  function injectOrUpdateButton(payload) {
    let btn = document.getElementById(BTN_ID);

    if (!btn) {
      btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.textContent = 'Betygsätt med PeerRate';

      Object.assign(btn.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: '999999',
        background: 'linear-gradient(135deg, #0b1f3b, #132f55)',
        color: '#ffffff',
        padding: '14px 18px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.15)',
        fontSize: '14px',
        fontWeight: '700',
        letterSpacing: '0.2px',
        cursor: 'pointer',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)'
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 16px 40px rgba(0,0,0,0.45)';
      });

      btn.addEventListener('click', async () => {
        const activePayload = latestPayload || payload;
        if (!activePayload) return;

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Öppnar PeerRate...';

        try {
          const result = await sendMessageAsync({
            type: 'openRatingForPayload',
            payload: activePayload,
          });

          if (result?.ok === true && result?.opened === true) {
            btn.disabled = false;
            btn.textContent = originalText;
            return;
          }

          removeButton();

          if (result?.alreadyRated === true) {
            alert('Den här affären har redan betygsatts i PeerRate.');
            return;
          }

          console.warn('[PeerRate extension] openRatingForPayload failed', result);
        } catch (err) {
          console.warn('[PeerRate extension] click handler failed:', err);
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

    btn.dataset.proofRef = payload?.proofRef || '';
    btn.dataset.source = payload?.source || '';
  }

  function removeButton() {
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.remove();
  }

  function getNormalizedLines(text) {
    return String(text || '')
      .split('\n')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function isProbablyLabel(line) {
    const lower = normalizeLower(line);
    return [
      'ordernr',
      'objektnr',
      'summering',
      'frakt',
      'totalt',
      'betald',
      'avhämtning',
      'omdöme',
      'behöver du hjälp',
      'köp nu',
      'fler åtgärder',
      'sälj vidare',
      'lämna omdöme',
      'tradera',
    ].some((x) => lower.includes(x));
  }

  function isZipCityLine(line) {
    return /^\d{3}\s?\d{2}\s+.+/.test(normalizeText(line));
  }

  function extractCounterpartyFromOrderPage() {
    const mailEl = document.querySelector('a[href^="mailto:"]');
    const email = mailEl
      ? normalizeText((mailEl.getAttribute('href') || '').replace(/^mailto:/i, ''))
      : null;

    const telEl = document.querySelector('a[href^="tel:"]');
    let phone = telEl ? normalizeText(telEl.textContent || '') : null;

    let name = null;
    let addressStreet = null;
    let addressZip = null;
    let addressCity = null;
    let country = null;

    let bestLines = [];

    if (mailEl) {
      let node = mailEl.closest('div, section, article, li') || mailEl.parentElement;
      for (let i = 0; i < 5 && node; i += 1) {
        const lines = getNormalizedLines(node.innerText || '');
        if (lines.length > bestLines.length) {
          bestLines = lines;
        }
        node = node.parentElement;
      }
    }

    if (!bestLines.length) {
      bestLines = getNormalizedLines(document.body?.innerText || '');
    }

    for (const line of bestLines) {
      if (!line) continue;
      if (email && normalizeLower(line).includes(normalizeLower(email))) continue;
      if (isProbablyLabel(line)) continue;

      if (!name) {
        const words = line.split(/\s+/);
        if (
          words.length >= 2 &&
          words.length <= 5 &&
          !/\d{3}\s?\d{2}/.test(line) &&
          !line.includes('@')
        ) {
          name = line;
          continue;
        }
      }

      if (!addressStreet) {
        if (
          /\d/.test(line) &&
          /[A-Za-zÅÄÖåäö]/.test(line) &&
          !isZipCityLine(line) &&
          !line.includes('@')
        ) {
          addressStreet = line;
          continue;
        }
      }

      if (!addressZip && !addressCity && isZipCityLine(line)) {
        const m = line.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
        if (m) {
          addressZip = normalizeText(m[1]);
          addressCity = normalizeText(m[2]);
          continue;
        }
      }

      if (!country && /^(sverige|sweden)$/i.test(normalizeText(line))) {
        country = normalizeText(line);
      }
    }

    if (!phone) {
      phone = extractPhoneFromText(document.body?.innerText || '');
    }

    return {
      email,
      name,
      phone,
      addressStreet,
      addressZip,
      addressCity,
      country,
    };
  }

  function extractOrderInfo() {
    const t = String(document.body?.innerText || '');

    const orderMatch = t.match(/Ordernr\.?\s*([0-9 ]{4,})/i);
    const orderId = orderMatch ? orderMatch[1].trim().replace(/\s+/g, '') : null;

    const itemMatch = t.match(/Objektnr\s*([0-9 ]{4,})/i);
    const itemId = itemMatch ? itemMatch[1].trim().replace(/\s+/g, '') : null;

    let title = null;
    if (itemMatch) {
      const idx = t.indexOf(itemMatch[0]);
      if (idx !== -1) {
        const after = t.slice(idx + itemMatch[0].length, idx + itemMatch[0].length + 300);
        const lines = getNormalizedLines(after);
        title = lines.find((line) => {
          if (!line) return false;
          if (isProbablyLabel(line)) return false;
          if (/^\d+\s*kr$/i.test(line)) return false;
          if (/\b\d{1,2}\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\b/i.test(line)) return false;
          return line.length >= 3;
        }) || null;
      }
    }

    const amount = extractAmountSEK(t);
    const dateISO = extractDateISO(t);

    return {
      orderId,
      itemId,
      title,
      amount,
      currency: amount != null ? 'SEK' : null,
      dateISO,
    };
  }

  function extractAmountSEK(text) {
    const lower = String(text || '').toLowerCase();

    const keys = ['totalt', 'total', 'summa', 'att betala'];
    for (const key of keys) {
      const idx = lower.indexOf(key);
      if (idx !== -1) {
        const windowText = text.slice(idx, idx + 500);
        const m = windowText.match(/([0-9]{1,3}(?:[ \u00A0][0-9]{3})*|[0-9]{1,7})\s*kr\b/i);
        if (m) {
          const num = m[1].replace(/[ \u00A0]/g, '');
          const n = Number(num);
          if (!Number.isNaN(n)) return n;
        }
      }
    }

    const all = Array.from(text.matchAll(/([0-9]{1,3}(?:[ \u00A0][0-9]{3})*|[0-9]{1,7})\s*kr\b/gi));
    if (all.length) {
      const last = all[all.length - 1];
      const num = (last[1] || '').replace(/[ \u00A0]/g, '');
      const n = Number(num);
      if (!Number.isNaN(n)) return n;
    }

    return null;
  }

  function extractDateISO(text) {
    const t = text || '';

    const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const se = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (se) {
      const dd = String(se[1]).padStart(2, '0');
      const mm = String(se[2]).padStart(2, '0');
      return `${se[3]}-${mm}-${dd}`;
    }

    const m = t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\b(?:\s+(20\d{2}))?/i);
    if (m) {
      const dd = String(m[1]).padStart(2, '0');
      const mon = m[2].toLowerCase();
      const map = { jan:'01', feb:'02', mar:'03', apr:'04', maj:'05', jun:'06', jul:'07', aug:'08', sep:'09', okt:'10', nov:'11', dec:'12' };
      const mm = map[mon] || '01';
      const yyyy = m[3] ? String(m[3]) : String(new Date().getFullYear());
      return `${yyyy}-${mm}-${dd}`;
    }

    return null;
  }

  function extractPhoneFromText(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();

    const m =
      t.match(/(\+46\s?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,3})/) ||
      t.match(/\b(0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,3})\b/);

    return m ? m[1].trim() : null;
  }
})();
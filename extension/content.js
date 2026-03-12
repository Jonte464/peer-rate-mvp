// extension/content.js
// PeerRate – Tradera trigger (robust extraction reset)
// Mål:
// - bara agera på riktiga Tradera order-sidor (/my/order/)
// - extrahera så mycket data som möjligt, även om sidan varierar
// - hitta e-post/telefon både via länkar och fri text
// - när användaren klickar: extrahera på nytt i flera snabba försök
// - skicka den rikaste payloaden till service-worker

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
    const maxTries = 30;

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

    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        scheduleEvaluate(0);
      }
    }, 500);
  }

  function scheduleEvaluate(delayMs = 200) {
    if (evaluateTimer) clearTimeout(evaluateTimer);
    evaluateTimer = setTimeout(() => {
      void evaluatePage();
    }, delayMs);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(v) {
    return String(v || '').replace(/\u00A0/g, ' ').trim();
  }

  function normalizeLower(v) {
    return normalizeText(v).toLowerCase();
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
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

  function isRelevantTraderaOrderPage() {
    const url = location.href.toLowerCase();
    return url.includes('tradera.') && url.includes('/my/order/');
  }

  function getBodyText() {
    return String(document.body?.innerText || '').replace(/\u00A0/g, ' ');
  }

  function getNormalizedLines(text) {
    return String(text || '')
      .split('\n')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function findAllEmails(text) {
    const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return unique(matches.map((x) => normalizeText(x).toLowerCase()));
  }

  function findAllPhones(text) {
    const source = String(text || '').replace(/\u00A0/g, ' ');
    const matches = source.match(/(?:\+46|0)\s?\d(?:[\d\s-]{5,}\d)/g) || [];
    return unique(
      matches
        .map((x) => normalizeText(x))
        .map((x) => x.replace(/\s{2,}/g, ' '))
    );
  }

  function extractEmailsFromDom() {
    const fromMailto = [...document.querySelectorAll('a[href^="mailto:"]')]
      .map((a) => normalizeText((a.getAttribute('href') || '').replace(/^mailto:/i, '')))
      .filter(Boolean)
      .map((x) => x.toLowerCase());

    const fromText = findAllEmails(getBodyText());
    return unique([...fromMailto, ...fromText]);
  }

  function extractPhonesFromDom() {
    const fromTelHref = [...document.querySelectorAll('a[href^="tel:"]')]
      .map((a) => normalizeText((a.getAttribute('href') || '').replace(/^tel:/i, '')))
      .filter(Boolean);

    const fromTelText = [...document.querySelectorAll('a[href^="tel:"]')]
      .map((a) => normalizeText(a.textContent || ''))
      .filter(Boolean);

    const fromText = findAllPhones(getBodyText());
    return unique([...fromTelHref, ...fromTelText, ...fromText]);
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
      'kontakta',
      'orderinformation',
      'spåra paket',
      'skickad',
      'betald',
    ].some((x) => lower.includes(x));
  }

  function isZipCityLine(line) {
    return /^\d{3}\s?\d{2}\s+.+/.test(normalizeText(line));
  }

  function isLikelyNameLine(line) {
    const txt = normalizeText(line);
    if (!txt) return false;
    if (txt.includes('@')) return false;
    if (/\d{3}\s?\d{2}/.test(txt)) return false;
    if (/^\+?\d[\d\s-]+$/.test(txt)) return false;
    if (isProbablyLabel(txt)) return false;

    const words = txt.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;

    return words.some((w) => /[A-Za-zÅÄÖåäö]/.test(w));
  }

  function getCandidateContactRoots() {
    const roots = [];

    const explicitIds = [
      document.getElementById('contact'),
      document.querySelector('[id*="contact" i]'),
      document.querySelector('[data-sentry-component="InfoSection"]'),
    ].filter(Boolean);

    roots.push(...explicitIds);

    for (const a of document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]')) {
      let node = a;
      for (let i = 0; i < 6 && node; i += 1) {
        roots.push(node);
        node = node.parentElement;
      }
    }

    const keywordBlocks = [...document.querySelectorAll('div, section, article')]
      .filter((el) => {
        const txt = normalizeText(el.innerText || '');
        if (!txt) return false;
        if (txt.length > 2500) return false;
        return /kontakta|ordernr|summering|objektnr|totalt|frakt|sverige/i.test(txt);
      })
      .slice(0, 12);

    roots.push(...keywordBlocks);

    return unique(roots);
  }

  function chooseBestContactText() {
    const roots = getCandidateContactRoots();
    const bodyText = getBodyText();

    let best = '';
    let bestScore = -1;

    for (const root of roots) {
      const txt = normalizeText(root?.innerText || '');
      if (!txt) continue;

      let score = 0;
      if (/kontakta/i.test(txt)) score += 3;
      if (/sverige/i.test(txt)) score += 2;
      if (findAllEmails(txt).length) score += 5;
      if (findAllPhones(txt).length) score += 4;
      if (/^\d{3}\s?\d{2}\s+/m.test(txt)) score += 2;
      if (txt.length >= 40 && txt.length <= 900) score += 2;

      if (score > bestScore) {
        bestScore = score;
        best = txt;
      }
    }

    if (!best) {
      const lines = getNormalizedLines(bodyText).slice(0, 120);
      best = lines.join('\n');
    }

    return best;
  }

  function extractCounterpartyFromOrderPage() {
    const emails = extractEmailsFromDom();
    const phones = extractPhonesFromDom();

    const contactText = chooseBestContactText();
    const contactLines = getNormalizedLines(contactText);
    const allLines = getNormalizedLines(getBodyText());

    const email = emails[0] || null;
    const phone = phones[0] || null;

    let name = null;
    let addressStreet = null;
    let addressZip = null;
    let addressCity = null;
    let country = null;

    const lines = contactLines.length ? contactLines : allLines;

    for (const line of lines) {
      const txt = normalizeText(line);
      if (!txt) continue;

      const lower = normalizeLower(txt);

      if (email && lower.includes(normalizeLower(email))) continue;
      if (phone && txt.includes(phone)) continue;

      if (!name && isLikelyNameLine(txt)) {
        name = txt;
        continue;
      }

      if (!addressStreet) {
        if (
          /\d/.test(txt) &&
          /[A-Za-zÅÄÖåäö]/.test(txt) &&
          !isZipCityLine(txt) &&
          !txt.includes('@') &&
          !/^\+?\d[\d\s-]+$/.test(txt) &&
          !isProbablyLabel(txt)
        ) {
          addressStreet = txt;
          continue;
        }
      }

      if (!addressZip && !addressCity && isZipCityLine(txt)) {
        const m = txt.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
        if (m) {
          addressZip = normalizeText(m[1]);
          addressCity = normalizeText(m[2]);
          continue;
        }
      }

      if (!country && /^(sverige|sweden)$/i.test(txt)) {
        country = txt;
      }
    }

    if (!name) {
      const fallbackName = allLines.find((line) => isLikelyNameLine(line));
      if (fallbackName) name = fallbackName;
    }

    if (!addressStreet || !addressZip || !addressCity) {
      for (let i = 0; i < allLines.length; i += 1) {
        const line = allLines[i];

        if (!addressStreet) {
          if (
            /\d/.test(line) &&
            /[A-Za-zÅÄÖåäö]/.test(line) &&
            !isZipCityLine(line) &&
            !line.includes('@') &&
            !/^\+?\d[\d\s-]+$/.test(line) &&
            !isProbablyLabel(line)
          ) {
            addressStreet = line;
          }
        }

        if (!addressZip && !addressCity && isZipCityLine(line)) {
          const m = line.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
          if (m) {
            addressZip = normalizeText(m[1]);
            addressCity = normalizeText(m[2]);
          }
        }

        if (!country && /^(sverige|sweden)$/i.test(line)) {
          country = line;
        }
      }
    }

    return {
      email: email ? email.toLowerCase() : null,
      name,
      phone,
      addressStreet,
      addressZip,
      addressCity,
      country,
    };
  }

  function extractAmountSEK(text) {
    const full = String(text || '').replace(/\u00A0/g, ' ');
    const lower = full.toLowerCase();

    const keys = ['totalt', 'total', 'summa', 'att betala'];
    for (const key of keys) {
      const idx = lower.indexOf(key);
      if (idx !== -1) {
        const windowText = full.slice(idx, idx + 500);
        const matches = [...windowText.matchAll(/([0-9]{1,3}(?:[ ]?[0-9]{3})*|[0-9]{1,7})\s*kr\b/gi)];
        if (matches.length) {
          const last = matches[matches.length - 1];
          const num = String(last[1] || '').replace(/\s/g, '');
          const n = Number(num);
          if (!Number.isNaN(n)) return n;
        }
      }
    }

    const all = [...full.matchAll(/([0-9]{1,3}(?:[ ]?[0-9]{3})*|[0-9]{1,7})\s*kr\b/gi)];
    if (all.length) {
      const values = all
        .map((m) => Number(String(m[1] || '').replace(/\s/g, '')))
        .filter((n) => !Number.isNaN(n));

      if (values.length) {
        return Math.max(...values);
      }
    }

    return null;
  }

  function extractDateISO(text) {
    const t = String(text || '');

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

  function extractTitleNearItem(text) {
    const full = String(text || '');
    const itemMatch = full.match(/Objektnr\s*([0-9 ]{4,})/i);
    if (!itemMatch) return null;

    const idx = full.indexOf(itemMatch[0]);
    if (idx === -1) return null;

    const after = full.slice(idx + itemMatch[0].length, idx + itemMatch[0].length + 500);
    const lines = getNormalizedLines(after);

    return (
      lines.find((line) => {
        if (!line) return false;
        if (isProbablyLabel(line)) return false;
        if (/^\d+\s*kr$/i.test(line)) return false;
        if (/^\d{1,2}\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i.test(line)) return false;
        if (/^\+?\d[\d\s-]+$/.test(line)) return false;
        if (line.includes('@')) return false;
        return line.length >= 4;
      }) || null
    );
  }

  function extractOrderInfo() {
    const text = getBodyText();

    const orderMatch = text.match(/Ordernr\.?\s*([0-9 ]{4,})/i);
    const orderId = orderMatch ? orderMatch[1].trim().replace(/\s+/g, '') : null;

    const itemMatch = text.match(/Objektnr\s*([0-9 ]{4,})/i);
    const itemId = itemMatch ? itemMatch[1].trim().replace(/\s+/g, '') : null;

    const title = extractTitleNearItem(text);
    const amount = extractAmountSEK(text);
    const dateISO = extractDateISO(text);

    return {
      orderId,
      itemId,
      title,
      amount,
      currency: amount != null ? 'SEK' : null,
      dateISO,
      date: dateISO,
    };
  }

  function buildPayload() {
    if (!isRelevantTraderaOrderPage()) return null;

    const pageUrl = location.href;
    const cp = extractCounterpartyFromOrderPage();
    const order = extractOrderInfo();

    const proofRef = order.orderId || pageUrl;
    if (!proofRef) return null;

    return {
      v: 3,
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
          email: cp.email || null,
          name: cp.name || null,
          phone: cp.phone || null,
          addressStreet: cp.addressStreet || null,
          addressZip: cp.addressZip || null,
          addressCity: cp.addressCity || null,
          country: cp.country || null,
        },
      },
      counterparty: {
        email: cp.email || null,
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
      subjectEmail: cp.email || '',
    };
  }

  function scorePayload(payload) {
    if (!payload) return 0;

    let score = 0;

    if (payload?.proofRef) score += 3;
    if (payload?.deal?.orderId) score += 3;
    if (payload?.deal?.itemId) score += 2;
    if (payload?.deal?.title) score += 2;
    if (payload?.deal?.amount != null) score += 3;
    if (payload?.deal?.dateISO) score += 2;

    if (payload?.counterparty?.email) score += 6;
    if (payload?.counterparty?.phone) score += 3;
    if (payload?.counterparty?.name) score += 3;
    if (payload?.counterparty?.addressStreet) score += 2;
    if (payload?.counterparty?.addressZip) score += 1;
    if (payload?.counterparty?.addressCity) score += 1;
    if (payload?.counterparty?.country) score += 1;

    return score;
  }

  async function getFreshBestPayload() {
    let best = null;
    let bestScore = -1;

    for (let i = 0; i < 6; i += 1) {
      const payload = buildPayload();
      const score = scorePayload(payload);

      if (score > bestScore) {
        best = payload;
        bestScore = score;
      }

      if (bestScore >= 16) break;
      await sleep(220);
    }

    return best;
  }

  async function evaluatePage() {
    if (isEvaluating) return;
    isEvaluating = true;

    try {
      const payload = buildPayload();

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
        backdropFilter: 'blur(6px)',
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
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Läser affären...';

        try {
          const bestPayload = (await getFreshBestPayload()) || latestPayload || payload;

          if (!bestPayload) {
            removeButton();
            return;
          }

          btn.textContent = 'Öppnar PeerRate...';

          const result = await sendMessageAsync({
            type: 'openRatingForPayload',
            payload: bestPayload,
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
})();
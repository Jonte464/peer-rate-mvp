// backend/services/traderaImporter.js
//
// Ny version UTAN Playwright.
// Gör "session-scraping" mot Tradera via vanliga HTTP-anrop + HTML-parsning med Cheerio.
//
// Flöde (förenklat):
//  1) Hämta login-sidan, samla cookies + hidden-fält
//  2) POST:a login-formuläret med användarnamn/lösenord
//  3) Använd den inloggade sessionen (cookies) för att hämta:
//       - /my/purchases  (köpta)
//       - /my/sold       (sålda)
//  4) Plocka ut affärer ur HTML:n med Cheerio
//
// OBS: HTML-strukturen på Tradera kan ändras över tid.
// Den här koden är en "bästa gissning" och kan behöva justeras
// om Tradera gör om sin layout.

const cheerio = require('cheerio');

const LOGIN_URL = 'https://www.tradera.com/login';
const PURCHASES_URL = 'https://www.tradera.com/my/purchases';
const SOLD_URL = 'https://www.tradera.com/my/sold';

// En enkel User-Agent så att vi inte ser ut som "no user agent".
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// -----------------------------
// Cookie-hjälpare
// -----------------------------

/**
 * Plocka Set-Cookie-rader från ett svar och uppdatera en cookie-"jar".
 * Vi struntar i alla attribut (path, secure, httponly osv).
 */
function extractCookiesFromResponse(res, jar) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return jar;

  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];

  for (const raw of parts) {
    if (!raw) continue;
    const firstPart = raw.split(';')[0].trim(); // t.ex. "Name=Value"
    if (!firstPart) continue;
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const value = firstPart.slice(eqIdx + 1).trim();
    if (!name) continue;
    jar[name] = value;
  }

  return jar;
}

/** Bygg Cookie-headern från vår enkla jar */
function cookieJarToHeader(jar) {
  const parts = [];
  for (const [k, v] of Object.entries(jar || {})) {
    if (!k || v === undefined || v === null) continue;
    parts.push(`${k}=${v}`);
  }
  return parts.join('; ');
}

/**
 * Gör ett fetch-anrop med cookies och uppdaterar jarren med ev. nya Set-Cookie-rader.
 */
async function fetchWithCookies(url, options = {}, jar = {}) {
  const headers = Object.assign(
    {
      'User-Agent': DEFAULT_UA,
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
    options.headers || {}
  );

  const cookieHeader = cookieJarToHeader(jar);
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    redirect: options.redirect || 'follow',
  });

  extractCookiesFromResponse(res, jar);
  return { res, jar };
}

// -----------------------------
// Inloggning mot Tradera
// -----------------------------

/**
 * Logga in mot Tradera via login-formuläret.
 * Försöker generiskt läsa av hidden-fält från första <form> på login-sidan.
 */
async function loginToTradera(username, password) {
  if (!username || !password) {
    throw new Error('Tradera-scraping: username och password krävs.');
  }

  let jar = {};

  // 1) Hämta login-sidan
  const { res: loginPageRes, jar: jarAfterLoginPage } = await fetchWithCookies(
    LOGIN_URL,
    { method: 'GET' },
    jar
  );
  jar = jarAfterLoginPage;
  const loginHtml = await loginPageRes.text();

  const $ = cheerio.load(loginHtml);

  const form = $('form').first();
  if (!form || form.length === 0) {
    throw new Error('Tradera-scraping: kunde inte hitta login-formulär.');
  }

  // Hitta form-action (kan vara relativ URL)
  const formAction = form.attr('action') || LOGIN_URL;
  const formUrl = new URL(formAction, LOGIN_URL).toString();

  // Bygg upp form-data med alla input[name], men ersätt username/password-fält
  const formData = new URLSearchParams();

  form.find('input[name]').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;

    let value = $(el).attr('value') || '';

    const lower = name.toLowerCase();
    if (lower.includes('user') || lower.includes('email') || lower.includes('login')) {
      value = username;
    }
    if (lower.includes('pass')) {
      value = password;
    }

    formData.append(name, value);
  });

  // 2) POST:a login-formuläret
  const { res: loginRes, jar: jarAfterLoginPost } = await fetchWithCookies(
    formUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      redirect: 'manual', // vi hanterar ev. redirect själva
    },
    jar
  );
  jar = jarAfterLoginPost;

  // Om vi får redirect -> följ den en gång
  if (loginRes.status >= 300 && loginRes.status < 400) {
    const location = loginRes.headers.get('location');
    if (location) {
      const redirectUrl = new URL(location, LOGIN_URL).toString();
      const follow = await fetchWithCookies(
        redirectUrl,
        { method: 'GET' },
        jar
      );
      jar = follow.jar;
    }
  } else {
    // Om vi inte redirectas – kontrollera om vi verkar vara inloggade.
    const body = await loginRes.text();
    if (body.toLowerCase().includes('felaktigt lösenord')) {
      throw new Error('Tradera-scraping: inloggning misslyckades (fel lösenord?).');
    }
  }

  // Som enkel test: hämta /my/purchases och se om vi fortfarande är på login-sidan
  const { res: testRes } = await fetchWithCookies(
    PURCHASES_URL,
    { method: 'GET' },
    jar
  );
  const testHtml = await testRes.text();
  if (testHtml.toLowerCase().includes('logga in') && testHtml.includes('login')) {
    throw new Error(
      'Tradera-scraping: verkar inte vara inloggad efter login-försök.'
    );
  }

  return { jar };
}

// -----------------------------
// Parsning av affärer från HTML
// -----------------------------

/**
 * Försök hitta avslutade affärer i HTML från /my/purchases eller /my/sold.
 * role: "BUYER" eller "SELLER"
 */
function parseOrdersFromHtml(html, { role }) {
  const $ = cheerio.load(html);

  // Hitta element som kan motsvara en "kort" / rad för en affär.
  const rows = $('article, .c-card, .c-transaction-row').filter((_, el) => {
    const text = $(el).text();
    return text && text.includes('Ordernr');
  });

  const orders = [];

  rows.each((_, el) => {
    const row = $(el);

    // Titel
    let title =
      row
        .find('a[href*="/item/"], a[href*="/auction/"], h3, h2')
        .first()
        .text()
        .trim() || '(utan titel)';

    // Pris
    let priceText = '';
    row.find('span, div').each((_, el2) => {
      if (priceText) return;
      const t = $(el2).text().trim();
      if (/\d+\s*(kr|KR|SEK)/.test(t)) {
        priceText = t;
      }
    });

    let amount = null;
    let currency = 'SEK';
    if (priceText) {
      const m = priceText.match(/([\d\s]+)\s*(SEK|kr|KR)?/i);
      if (m) {
        amount = Number(m[1].replace(/\s+/g, '')) || null;
        if (m[2]) {
          currency = m[2].toUpperCase().replace('KR', 'SEK');
        }
      }
    }

    // Datum
    let completedAt = null;
    const timeEl = row.find('time').first();
    if (timeEl && timeEl.length) {
      const dtAttr = timeEl.attr('datetime');
      const txt = timeEl.text().trim();
      const dtRaw = dtAttr || txt;
      if (dtRaw) {
        const d = new Date(dtRaw);
        if (!Number.isNaN(d.getTime())) {
          completedAt = d.toISOString();
        } else {
          completedAt = dtRaw;
        }
      }
    } else {
      // fallback: leta efter något som ser ut som "2025-12-03" eller "3 dec 2025"
      row.find('span, div').each((_, el2) => {
        if (completedAt) return;
        const t = $(el2).text().trim();
        if (/\d{4}-\d{2}-\d{2}/.test(t) || /\d{1,2}\s+\w+\s+\d{4}/.test(t)) {
          completedAt = t;
        }
      });
    }

    // Motpart
    let counterpartyAlias = null;
    row.find('span, div, strong').each((_, el2) => {
      const t = $(el2).text().trim();
      if (t.includes('Köpare') || t.includes('Säljare')) {
        counterpartyAlias = t.replace('Köpare', '').replace('Säljare', '').trim();
      }
    });

    // Ordernr / objektnr
    let traderaOrderId = null;
    let traderaItemId = null;

    row.find('span, div').each((_, el2) => {
      const t = $(el2).text().trim();
      if (t.includes('Ordernr') && !traderaOrderId) {
        const m = t.match(/(\d{6,})/);
        if (m) traderaOrderId = m[1];
      }
      if (t.includes('Objektnr') && !traderaItemId) {
        const m = t.match(/(\d{6,})/);
        if (m) traderaItemId = m[1];
      }
    });

    if (!traderaOrderId && !traderaItemId && !title) {
      return; // hoppa över helt tomma rader
    }

    orders.push({
      traderaId: traderaOrderId || traderaItemId || null,
      traderaOrderId,
      traderaItemId,
      title,
      role: role === 'SELLER' ? 'SELLER' : 'BUYER',
      amount,
      currency,
      completedAt,
      counterpartyAlias,
    });
  });

  return orders;
}

// -----------------------------
// Publik funktion: hämta affärer via HTML-scraping
// -----------------------------

/**
 * Huvudfunktion som används av traderaService.js:
 *
 *   const orders = await fetchTraderaOrdersViaScraping({ username, password, maxPages: 1 });
 *
 * maxPages används inte ännu (vi tar bara första sidan per vy),
 * men finns kvar för framtida pagination.
 */
async function fetchTraderaOrdersViaScraping({ username, password, maxPages = 1 }) {
  if (!username || !password) {
    throw new Error('Tradera-scraping: username och password krävs.');
  }

  // 1) Logga in och få en cookie-jar
  const { jar } = await loginToTradera(username, password);

  const allOrders = [];

  // 2) Hämta köpta
  const { res: purchasesRes } = await fetchWithCookies(
    PURCHASES_URL,
    { method: 'GET' },
    jar
  );
  const purchasesHtml = await purchasesRes.text();
  const bought = parseOrdersFromHtml(purchasesHtml, { role: 'BUYER' });
  allOrders.push(...bought);

  // 3) Hämta sålda
  const { res: soldRes } = await fetchWithCookies(
    SOLD_URL,
    { method: 'GET' },
    jar
  );
  const soldHtml = await soldRes.text();
  const soldOrders = parseOrdersFromHtml(soldHtml, { role: 'SELLER' });
  allOrders.push(...soldOrders);

  // (Framtid: pagination om maxPages > 1)

  // Logga lite i backend för felsökning:
  console.log(
    `[Tradera HTML-scraping] Hittade ${allOrders.length} affärer totalt ` +
      `(${bought.length} köpta, ${soldOrders.length} sålda).`
  );

  return allOrders;
}

module.exports = {
  fetchTraderaOrdersViaScraping,
};

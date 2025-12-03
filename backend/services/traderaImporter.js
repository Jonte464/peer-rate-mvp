// backend/services/traderaImporter.js
//
// Skiss på "riktig" Tradera-import via headless browser (Playwright).
// OBS: Detta är ett SKELETT. Du måste justera selectors/URL:er efter hur Tradera faktiskt ser ut.

const { chromium } = require('playwright'); // npm install playwright

/**
 * Loggar in på Tradera med användarnamn/lösenord och hämtar avslutade affärer.
 *
 * @param {Object} opts
 * @param {string} opts.username - Tradera-användarnamn
 * @param {string} opts.password - Tradera-lösenord
 * @param {number} [opts.maxPages=1] - Hur många sidor med historik du vill hämta (MVP: 1)
 * @returns {Promise<Array>} Normaliserad lista med affärer
 */
async function fetchTraderaOrdersViaScraping({ username, password, maxPages = 1 }) {
  if (!username || !password) {
    throw new Error('Tradera: username och password krävs för scraping');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1) Gå till login-sidan
    await page.goto('https://www.tradera.com/login', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // 2) Fyll i login-formulär
    // OBS: dessa selectors MÅSTE justeras efter verklig HTML på Tradera
    await page.fill('input[name="Username"]', username);
    await page.fill('input[name="Password"]', password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForLoadState('networkidle'),
    ]);

    // 3) Säkerställ att vi är inloggade (t.ex. genom att kolla efter ditt användarnamn eller en användarmeny)
    const loggedIn = await page.evaluate(() => {
      // PSEUDO: leta efter någon header / meny som bara syns för inloggade
      const el =
        document.querySelector('[data-testid="user-menu"]') ||
        document.querySelector('a[href*="/my/purchases"]');
      return !!el;
    });

    if (!loggedIn) {
      throw new Error('Tradera: Inloggning misslyckades (kunde inte hitta user-menu).');
    }

    const allOrders = [];

    // 4) Hämta "köpta" objekt
    await page.goto('https://www.tradera.com/my/purchases', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const bought = await scrapeOrderListOnCurrentPage(page, { role: 'BUYER' });
    allOrders.push(...bought);

    // 5) Hämta "sålda" objekt
    await page.goto('https://www.tradera.com/my/sold', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const sold = await scrapeOrderListOnCurrentPage(page, { role: 'SELLER' });
    allOrders.push(...sold);

    // TODO: pagination om du vill gå bakåt i historiken (maxPages > 1)

    return allOrders;
  } finally {
    await browser.close();
  }
}

/**
 * Scrapar avslutade affärer på "nuvarande sida".
 * Här behöver du anpassa CSS-selectors efter riktiga Tradera-HTML:en.
 */
async function scrapeOrderListOnCurrentPage(page, { role }) {
  // Här returnerar vi en array direkt från browser-konteksten
  const orders = await page.evaluate(({ role }) => {
    // Hitta alla rader / kort som motsvarar en avslutad affär
    //
    // *** OBS: Klassnamn / struktur ÄR PSEUDO EXEMPEL ***
    // Justera efter riktiga classer du ser i devtools, t.ex. 'article[data-testid="purchase-card"]' osv.
    const rows = Array.from(
      document.querySelectorAll('article, .c-card, .c-transaction-row')
    ).filter((row) => {
      // En väldigt grov filter: raden innehåller texten "Ordernr."
      return row.textContent.includes('Ordernr');
    });

    return rows.map((row) => {
      // Titel
      const titleEl =
        row.querySelector('a[href*="/item/"]') ||
        row.querySelector('a[href*="/auction/"]') ||
        row.querySelector('h3,h2');
      const title = titleEl ? titleEl.textContent.trim() : '(utan titel)';

      // Pris
      const priceEl =
        row.querySelector('[class*="price"]') ||
        row.querySelector('span:has(+ span:contains("kr"))');
      const priceText = priceEl ? priceEl.textContent.trim() : '';
      let amount = null;
      let currency = null;
      if (priceText) {
        const m = priceText.match(/([\d\s]+)\s*(SEK|kr|KR)?/i);
        if (m) {
          amount = Number(m[1].replace(/\s+/g, '')) || null;
          currency = m[2] ? m[2].toUpperCase().replace('KR', 'SEK') : 'SEK';
        }
      }

      // Datum
      const dateEl =
        row.querySelector('time') ||
        Array.from(row.querySelectorAll('span,div')).find((el) =>
          /\d{1,2}\s+\w+\s+\d{4}/.test(el.textContent)
        );
      let completedAt = null;
      if (dateEl) {
        const dtAttr = dateEl.getAttribute('datetime');
        const text = dateEl.textContent.trim();
        completedAt = dtAttr || text || null;
      }

      // Motpart (namn på säljare/köpare)
      const counterpartyEl = Array.from(
        row.querySelectorAll('span,div,strong')
      ).find((el) => el.textContent.includes('Köpare') || el.textContent.includes('Säljare'));
      const counterpartyAlias = counterpartyEl
        ? counterpartyEl.textContent.replace('Köpare', '').replace('Säljare', '').trim()
        : null;

      // Ordernr / objekt-id
      const orderEl = Array.from(
        row.querySelectorAll('span,div')
      ).find((el) => el.textContent.includes('Ordernr'));
      const traderaOrderId = orderEl
        ? (orderEl.textContent.match(/(\d{6,})/) || [null, null])[1]
        : null;

      const objectEl = Array.from(
        row.querySelectorAll('span,div')
      ).find((el) => el.textContent.includes('Objektnr'));
      const traderaItemId = objectEl
        ? (objectEl.textContent.match(/(\d{6,})/) || [null, null])[1]
        : null;

      return {
        traderaId: traderaOrderId,
        traderaOrderId,
        traderaItemId,
        title,
        role,
        amount,
        currency,
        completedAt,
        counterpartyAlias,
      };
    });
  }, { role });

  // Filtrera bort helt tomma rader
  return orders.filter(
    (o) => o && (o.title || o.traderaId || o.amount !== null)
  );
}

module.exports = {
  fetchTraderaOrdersViaScraping,
};

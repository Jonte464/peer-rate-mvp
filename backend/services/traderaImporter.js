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

    // 3) Säkerställ att vi är inloggade (t.ex. genom att kolla efter en "Min sida"-ikon eller användarnamn)
    // Här får du anpassa efter hur det faktiskt ser ut när du är inloggad
    const loggedIn = await page.evaluate(() => {
      // PSEUDO: leta efter någon header / meny som bara syns för inloggade
      const el = document.querySelector('[data-testid="user-menu"]');
      return !!el;
    });

    if (!loggedIn) {
      throw new Error('Tradera: Inloggning misslyckades (kunde inte hitta user-menu).');
    }

    const allOrders = [];

    // 4) Hämta "köpta" objekt
    // URL och selectors här är PSEUDO och måste justeras:
    await page.goto('https://www.tradera.com/my-page/purchases/completed', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const bought = await scrapeOrderListOnCurrentPage(page, { role: 'BUYER' });
    allOrders.push(...bought);

    // 5) Hämta "sålda" objekt
    await page.goto('https://www.tradera.com/my-page/sales/completed', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const sold = await scrapeOrderListOnCurrentPage(page, { role: 'SELLER' });
    allOrders.push(...sold);

    // Ev. stöd för pagination (maxPages > 1) – kan läggas till senare

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
    // *** OBS: Klassnamn / struktur ÄR PSEUDO EXEMPEL ***
    const rows = Array.from(
      document.querySelectorAll('.completed-auction-row, .c-transaction-row')
    );

    return rows.map((row) => {
      // Hitta titel
      const titleEl = row.querySelector('.item-title, .c-transaction-title');
      const title = titleEl ? titleEl.textContent.trim() : '(utan titel)';

      // Hitta pris
      const priceEl = row.querySelector('.item-price, .c-transaction-price');
      const priceText = priceEl ? priceEl.textContent.trim() : '';
      // Försök plocka ut belopp & valuta med simpel regex
      let amount = null;
      let currency = null;
      if (priceText) {
        const m = priceText.match(/([\d\s]+)\s*(SEK|kr|KR)?/i);
        if (m) {
          amount = Number(m[1].replace(/\s+/g, '')) || null;
          currency = m[2] ? m[2].toUpperCase().replace('KR', 'SEK') : 'SEK';
        }
      }

      // Hitta datum
      const dateEl = row.querySelector('.item-date, time, .c-transaction-date');
      let completedAt = null;
      if (dateEl) {
        const dtAttr = dateEl.getAttribute('datetime');
        const text = dateEl.textContent.trim();
        completedAt = dtAttr || text || null;
      }

      // Hitta motpart
      const counterpartyEl = row.querySelector('.counterparty, .c-transaction-counterparty');
      const counterpartyAlias = counterpartyEl ? counterpartyEl.textContent.trim() : null;

      // Hitta någon form av unikt ID (t.ex. länk till objektsida)
      const linkEl = row.querySelector('a[href*="/item/"], a[href*="/auction/"]');
      const href = linkEl ? linkEl.getAttribute('href') || '' : '';
      let traderaId = null;
      if (href) {
        const m = href.match(/(\d+)/g);
        if (m && m.length) {
          traderaId = m[m.length - 1];
        }
      }

      return {
        traderaId,
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

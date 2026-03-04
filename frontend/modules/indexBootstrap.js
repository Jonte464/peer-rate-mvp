// frontend/modules/indexBootstrap.js
// Laddar index-partials, startar hero-video,
// laddar sedan /modules/main.js och triggar DOMContentLoaded manuellt
// (för kompatibilitet om main.js väntar på DOMContentLoaded).

async function loadPartialInto(slotId, url) {
  const slot = document.getElementById(slotId);
  if (!slot) throw new Error(`Slot saknas: ${slotId}`);

  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`Kunde inte hämta ${url} (status ${resp.status})`);

  slot.innerHTML = await resp.text();
}

/**
 * Försöker hitta en nav-container i top-row-partialen och
 * lägger till en länk till /extension.html om den saknas.
 * Detta är designat för att vara "robust" utan att vi behöver veta exakt HTML-struktur.
 */
function injectExtensionNavLink() {
  const topRow = document.getElementById('slot-top-row');
  if (!topRow) return;

  // Om länken redan finns någonstans i top-row, gör inget.
  const existing = topRow.querySelector('a[href="/extension.html"], a[href="\/extension.html"]');
  if (existing) return;

  // Kandidater för var nav-länkar kan ligga
  const candidates = [
    'nav',
    '.nav',
    '.navbar',
    '.top-nav',
    '.topbar',
    'header nav',
    '[data-nav]',
    '[role="navigation"]',
  ];

  let navEl = null;
  for (const sel of candidates) {
    const found = topRow.querySelector(sel);
    if (found) { navEl = found; break; }
  }

  // Om vi inte hittar en tydlig nav, försök hitta en "länk-rad" (många <a> bredvid varandra)
  if (!navEl) {
    const linkGroups = Array.from(topRow.querySelectorAll('div, ul, section'))
      .filter(el => el.querySelectorAll('a').length >= 2);
    navEl = linkGroups[0] || null;
  }

  if (!navEl) {
    console.warn('[indexBootstrap] Hittade ingen nav-container i top-row att injicera Extension-länk i.');
    return;
  }

  // Skapa länken
  const a = document.createElement('a');
  a.href = '/extension.html';
  a.textContent = 'Extension';

  // Minimal styling som brukar smälta in (utan att slå ut ditt tema)
  a.style.whiteSpace = 'nowrap';

  // Försök lägga länken "snyggt" på slutet:
  // - om nav innehåller en <ul>, lägg som <li><a/></li>
  const ul = navEl.querySelector('ul');
  if (ul) {
    const li = document.createElement('li');
    li.appendChild(a);
    ul.appendChild(li);
    return;
  }

  // Om nav är en container med länkar direkt, append:a
  navEl.appendChild(a);
}

function setupHeroVideoAutoplay() {
  const v = document.querySelector('.hero video');
  if (!v) return;

  v.addEventListener('loadeddata', () => {
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  });
}

function fireCompatEvents() {
  // Viktigt: Om main.js använder DOMContentLoaded som "startsignal"
  // och vi importerar main.js efter att eventen redan skett,
  // så triggar vi den manuellt här.
  try {
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  } catch (_) {
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
}

async function bootstrap() {
  await loadPartialInto('slot-top-row', '/partials/index/top-row.html');

  // ✅ Injicera Extension-länk i header/nav (om den saknas)
  injectExtensionNavLink();

  await loadPartialInto('slot-hero', '/partials/index/hero.html');
  await loadPartialInto('slot-how', '/partials/index/how.html');
  await loadPartialInto('slot-sim', '/partials/index/sim.html');
  await loadPartialInto('slot-globe', '/partials/index/globe.html');
  // ✅ rate-partial borttagen (Lämna betyg flyttat till /rate.html)
  await loadPartialInto('slot-footer', '/partials/index/footer.html');

  setupHeroVideoAutoplay();

  // Ladda din befintliga logik
  await import('/modules/main.js');

  // Kompatibilitet för äldre init-mönster i main.js
  fireCompatEvents();
}

bootstrap().catch((err) => {
  console.error('[indexBootstrap] Fel vid boot:', err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<div style="padding:16px;font-family:system-ui;color:#b00020">
      <b>Index-laddning misslyckades.</b><br/>
      Öppna DevTools Console för detaljer.
    </div>`
  );
});
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

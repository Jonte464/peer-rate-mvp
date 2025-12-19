// frontend/modules/indexBootstrap.js
// Laddar in index-partials i rätt ordning,
// startar hero-videon "säkert",
// och laddar sedan din befintliga /modules/main.js (så vi inte bryter något).

async function loadPartialInto(slotId, url) {
  const slot = document.getElementById(slotId);
  if (!slot) throw new Error(`Slot saknas: ${slotId}`);

  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) {
    throw new Error(`Kunde inte hämta ${url} (status ${resp.status})`);
  }

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

async function bootstrap() {
  // 1) Ladda all HTML först (så att main.js hittar allt den behöver)
  await loadPartialInto('slot-top-row', '/partials/index/top-row.html');
  await loadPartialInto('slot-hero', '/partials/index/hero.html');
  await loadPartialInto('slot-how', '/partials/index/how.html');
  await loadPartialInto('slot-sim', '/partials/index/sim.html');
  await loadPartialInto('slot-globe', '/partials/index/globe.html');
  await loadPartialInto('slot-rate', '/partials/index/rate.html');
  await loadPartialInto('slot-footer', '/partials/index/footer.html');

  // 2) Hero-video autoplayer (flyttat från inline <script>)
  setupHeroVideoAutoplay();

  // 3) Ladda din befintliga logik (i18n, meny, sliders, osv)
  await import('/modules/main.js');
}

bootstrap().catch((err) => {
  console.error('[indexBootstrap] Fel vid boot:', err);

  // Minimal fallback så du ser något även om partial-laddning fallerar
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<div style="padding:16px;font-family:system-ui;color:#b00020">
      <b>Index-laddning misslyckades.</b><br/>
      Öppna DevTools Console för detaljer.
    </div>`
  );
});

// frontend/modules/ratingPlatform.js
export function initRatingPlatform() {
  const platformCard = document.getElementById('platform-card');
  const emailCard = document.getElementById('email-card');

  const choosePlatformBtn = document.getElementById('choosePlatformBtn');
  const chooseEmailBtn = document.getElementById('chooseEmailBtn');

  const select = document.getElementById('platformSelect');
  const flow = document.getElementById('platformFlow');
  const btn = document.getElementById('platformGoBtn');

  if (!choosePlatformBtn || !chooseEmailBtn) return; // inte rate-sidan/hubben

  const urls = {
    tradera: 'https://www.tradera.com/',
    blocket: 'https://www.blocket.se/',
    airbnb: 'https://www.airbnb.com/',
    ebay: 'https://www.ebay.com/',
    tiptap: 'https://tiptap.se/',
    hygglo: 'https://www.hygglo.se/',
    husknuten: 'https://www.husknuten.se/',
    facebook: 'https://www.facebook.com/marketplace/',
  };

  function showPlatform() {
    if (platformCard) platformCard.style.display = 'block';
    if (emailCard) emailCard.style.display = 'none';
    platformCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showEmail() {
    if (emailCard) emailCard.style.display = 'block';
    if (platformCard) platformCard.style.display = 'none';
    emailCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  choosePlatformBtn.addEventListener('click', showPlatform);
  chooseEmailBtn.addEventListener('click', showEmail);

  // Default: visa plattform om man kommer hit med ?source=... (från extension)
  const params = new URLSearchParams(window.location.search || '');
  if ((params.get('source') || '').trim()) showPlatform();

  function updateBtn() {
    if (!select || !flow || !btn) return;
    const hasPlatform = !!urls[select.value];
    const hasFlow = !!(flow.value || '').trim();
    btn.disabled = !(hasPlatform && hasFlow);
  }

  function flowLabel(v) {
    return (
      {
        buy: 'Köp',
        sell: 'Sälj',
        booking: 'Bokning/hyra',
        other: 'Annat',
      }[v] || ''
    );
  }

  function platformLabel(k) {
    const map = {
      tradera: 'Tradera',
      blocket: 'Blocket',
      airbnb: 'Airbnb',
      ebay: 'eBay',
      tiptap: 'Tiptap',
      hygglo: 'Hygglo',
      husknuten: 'Husknuten',
      facebook: 'Facebook Marketplace',
    };
    return map[k] || k;
  }

  function updateStepsText() {
    const steps = document.getElementById('platformSteps');
    if (!steps) return;

    const p = select?.value;
    const f = flow?.value;
    if (!p || !f) return;

    const pName = platformLabel(p);
    const fName = flowLabel(f);

    steps.innerHTML = `
      <b>Så gör du (${pName} · ${fName}):</b>
      <ol style="margin:6px 0 0 18px;padding:0;">
        <li>Öppna ${pName}.</li>
        <li>Logga in och hitta den <b>avslutade</b> affären (gärna “completed”, “orders”, “receipt/kvitto”).</li>
        <li>Öppna gärna <b>order/receipt/kvitto</b>-vyn om den finns.</li>
        <li>Klicka på PeerRate-extensionen för att skicka verifierad info.</li>
      </ol>
    `;
  }

  select?.addEventListener('change', () => {
    updateBtn();
    updateStepsText();
  });

  flow?.addEventListener('change', () => {
    updateBtn();
    updateStepsText();
  });

  btn?.addEventListener('click', () => {
    const key = select.value;
    const url = urls[key];
    if (!url) return;

    // Öppna plattform i ny flik
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  updateBtn();
  updateStepsText();
}

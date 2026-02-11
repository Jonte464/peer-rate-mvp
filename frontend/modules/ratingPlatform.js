// frontend/modules/ratingPlatform.js
export function initRatingPlatform() {
  const select = document.getElementById('platformSelect');
  const btn = document.getElementById('platformGoBtn');

  if (!select || !btn) return; // inte rate-sidan

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

  function updateBtn() {
    const key = select.value;
    const url = urls[key];

    btn.disabled = !url;
  }

  select.addEventListener('change', updateBtn);

  btn.addEventListener('click', () => {
    const key = select.value;
    const url = urls[key];
    if (!url) return;

    // Öppna plattform i ny flik
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  updateBtn();
}

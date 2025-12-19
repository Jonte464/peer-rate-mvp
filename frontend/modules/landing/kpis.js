// frontend/modules/landing/kpis.js
export function initKpis() {
  const kUsers = document.getElementById('kUsers');
  const kTx = document.getElementById('kTx');
  const kRatings = document.getElementById('kRatings');

  if (kUsers) kUsers.textContent = '—';
  if (kTx) kTx.textContent = '—';
  if (kRatings) kRatings.textContent = '—';
}

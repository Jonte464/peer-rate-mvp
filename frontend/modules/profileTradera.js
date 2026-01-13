// profileTradera.js – Tradera-kortet är tillfälligt AVSTÄNGT i UI
// (Vi behåller filen så att imports inte kraschar, men vi gör inget.)

export async function initTraderaSection() {
  const card = document.getElementById('tradera-card');
  if (card) {
    card.classList.add('hidden');
    card.style.display = 'none';
  }
  return;
}

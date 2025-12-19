// frontend/modules/landing/reputationFlip.js
export function initReputationFlip() {
  const flip = document.getElementById('repFlip');
  const backBtn = document.getElementById('flipBackBtn');
  if (!flip) return;

  const toggle = () => flip.classList.toggle('is-flipped');

  flip.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.target.closest('#flipBackBtn')) return;
    toggle();
  });

  flip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      flip.classList.remove('is-flipped');
    });
  }

  flip.addEventListener('mouseenter', () => {
    if (window.matchMedia('(hover:hover)').matches) flip.classList.add('is-flipped');
  });
  flip.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover:hover)').matches) flip.classList.remove('is-flipped');
  });
}

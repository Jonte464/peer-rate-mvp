// frontend/modules/landing/simulator.js
export function initTwoSliderSimulator() {
  const countSlider = document.getElementById('countSlider');
  const avgSlider = document.getElementById('avgSlider');
  if (!countSlider || !avgSlider) return;

  const simCount = document.getElementById('simCount');
  const simAvg = document.getElementById('simAvg');
  const simScore = document.getElementById('simScore');
  const simPCount = document.getElementById('simPCount');

  const heroScore = document.getElementById('heroScore');
  const repScore = document.getElementById('repScore');

  const pEls = Array.from(document.querySelectorAll('.pbar .p'));

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function volumeFactor(n) { return 1 - Math.exp(-n / 55); }

  function totalScore(count, avg) {
    const q = clamp((avg - 1) / 4, 0, 1);
    const v = clamp(volumeFactor(count), 0, 1);
    const base = 1 + 4 * (q * (0.55 + 0.45 * v));
    return clamp(base, 1, 5);
  }

  function pFilled(score) {
    if (score >= 4.6) return 5;
    if (score >= 4.0) return 4;
    if (score >= 3.3) return 3;
    if (score >= 2.3) return 2;
    return 1;
  }

  function setPBar(filled) {
    pEls.forEach((el, i) => el.classList.toggle('is-on', i < filled));
  }

  function update() {
    const count = Number(countSlider.value || 0);
    const avg = Number(avgSlider.value || 1);

    if (simCount) simCount.textContent = String(count);
    if (simAvg) simAvg.textContent = avg.toFixed(1);

    const score = totalScore(count, avg);
    const filled = pFilled(score);

    if (simScore) simScore.textContent = score.toFixed(1);
    if (simPCount) simPCount.textContent = String(filled);

    setPBar(filled);

    if (heroScore) heroScore.textContent = score.toFixed(1);
    if (repScore) repScore.textContent = score.toFixed(1);
  }

  countSlider.addEventListener('input', update);
  avgSlider.addEventListener('input', update);
  update();
}

// frontend/modules/landing/valueBoxes.js
// Interactive feature boxes for the 'How' section: Verified / Portable / Explainable
// - Adds keyboard and focus support
// - Hover/tap to reveal descriptive text
// - Respects prefers-reduced-motion

export function initValueBoxes() {
  // Attach stylesheet dynamically so partials don't need head changes
  try {
    const href = '/css/value-boxes.css';
    if (![...document.styleSheets].some(s => s.href && s.href.endsWith('value-boxes.css'))) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
    }
  } catch (e) {
    // ignore
  }

  // Find the grid that contains the three cards. It was previously .grid-3 inside #how
  const how = document.getElementById('how');
  if (!how) return;
  const grid = how.querySelector('.grid-3');
  if (!grid) return;

  // Enhance each card to be interactive
  const cards = Array.from(grid.children).filter(n => n.classList && n.classList.contains('w-card'));
  cards.forEach((card) => {
    card.classList.add('vb-card');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-expanded', 'false');

    // Move existing heading/text into structured elements for consistent behavior
    const h = card.querySelector('h3');
    const p = card.querySelector('p');

    const title = document.createElement('div');
    title.className = 'vb-title';
    const accent = document.createElement('div');
    accent.className = 'vb-accent';
    // keep original title text node
    if (h) {
      title.appendChild(h.cloneNode(true));
    }
    title.appendChild(accent);

    const desc = document.createElement('div');
    desc.className = 'vb-desc';
    if (p) desc.textContent = p.textContent.trim();

    // Clear card and append new structured nodes
    card.innerHTML = '';
    card.appendChild(title);
    card.appendChild(desc);

    let expanded = false;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setExpanded(v) {
      expanded = !!v;
      card.classList.toggle('expanded', expanded);
      card.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    // Event handlers
    card.addEventListener('mouseenter', () => setExpanded(true));
    card.addEventListener('mouseleave', () => setExpanded(false));
    card.addEventListener('focus', () => setExpanded(true));
    card.addEventListener('blur', () => setExpanded(false));

    // Mobile / touch: toggle on click/tap. If prefers-reduced-motion, reveal instantly.
    card.addEventListener('click', (e) => {
      // Prevent accidental double-activation when keyboard used
      if (e.detail === 0) return;
      setExpanded(!expanded);
    });

    // Keyboard: Enter / Space toggles
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExpanded(!expanded);
      }
      if (e.key === 'Escape') setExpanded(false);
    });
  });
}

export default initValueBoxes;

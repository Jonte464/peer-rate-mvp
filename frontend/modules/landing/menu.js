// frontend/modules/landing/menu.js
export function initLandingMenu() {
  const menuBtn = document.getElementById('menuBtn');
  const menuPanel = document.getElementById('menuPanel');
  if (!menuBtn || !menuPanel) return;

  if (menuBtn.dataset.menuBound === 'true') return;
  menuBtn.dataset.menuBound = 'true';

  let open = false;

  const setOpen = (value) => {
    open = Boolean(value);
    menuPanel.style.display = open ? 'block' : 'none';
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  menuPanel.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    setOpen(false);
  });

  window.addEventListener('click', (e) => {
    if (!open) return;
    if (e.target.closest('#menuBtn') || e.target.closest('#menuPanel')) return;
    setOpen(false);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  setOpen(false);
}
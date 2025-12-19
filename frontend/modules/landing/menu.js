// frontend/modules/landing/menu.js
export function initLandingMenu() {
  const menuBtn = document.getElementById('menuBtn');
  const menuPanel = document.getElementById('menuPanel');
  if (!menuBtn || !menuPanel) return;

  const setOpen = (open) => {
    menuPanel.style.display = open ? 'block' : 'none';
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  let open = false;
  menuBtn.addEventListener('click', () => {
    open = !open;
    setOpen(open);
  });

  menuPanel.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    open = false;
    setOpen(false);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

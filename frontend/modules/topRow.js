// frontend/modules/topRow.js
// Universell funktionalitet för Top Row (menu + user menu)

function $(id){ return document.getElementById(id); }

function show(el){ if (el) el.style.display = "block"; }
function hide(el){ if (el) el.style.display = "none"; }
function isVisible(el){ return !!el && getComputedStyle(el).display !== "none"; }

function closeAll() {
  hide($("menuPanel"));
  hide($("langMenu"));
  hide($("userMenu"));
  const menuBtn = $("menuBtn");
  const langBtn = $("langBtn");
  const userBtn = $("topUserBtn");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  if (langBtn) langBtn.setAttribute("aria-expanded", "false");
  if (userBtn) userBtn.setAttribute("aria-expanded", "false");
}

function toggle(el, btn) {
  const open = !isVisible(el);
  closeAll();
  if (open) {
    show(el);
    if (btn) btn.setAttribute("aria-expanded", "true");
  }
}

export function initTopRow() {
  const menuBtn = $("menuBtn");
  const menuPanel = $("menuPanel");

  const langBtn = $("langBtn");
  const langMenu = $("langMenu");

  const userBtn = $("topUserBtn");
  const userMenu = $("userMenu");

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(menuPanel, menuBtn);
    });
  }

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(langMenu, langBtn);
    });
  }

  if (userBtn && userMenu) {
    userBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(userMenu, userBtn);
    });
  }

  // Stäng när man klickar utanför
  document.addEventListener("click", () => closeAll());

  // ESC stänger
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  // Om man klickar på en länk i panelen → stäng panelen
  if (menuPanel) {
    menuPanel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) closeAll();
    });
  }
}
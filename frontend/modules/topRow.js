// frontend/modules/topRow.js
// Universell funktionalitet för Top Row (hamburgare + språk + user/gubbe + login/logout)

function $(id) {
  return document.getElementById(id);
}

function pickId(...ids) {
  for (const id of ids) {
    const el = $(id);
    if (el) return el;
  }
  return null;
}

function show(el) {
  if (el) el.style.display = "block";
}

function hide(el) {
  if (el) el.style.display = "none";
}

function isVisible(el) {
  return !!el && getComputedStyle(el).display !== "none";
}

function setAriaExpanded(btn, expanded) {
  if (!btn) return;
  btn.setAttribute("aria-expanded", expanded ? "true" : "false");
}

// -----------------------------
// Auth helpers
// -----------------------------
function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function hasPeerRateUser() {
  try {
    const raw = localStorage.getItem("peerRateUser");
    if (!raw) return false;
    const parsed = safeJsonParse(raw);
    return !!(parsed && (parsed.email || parsed.id));
  } catch (_) {
    return false;
  }
}

function getCookie(name) {
  const m = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([$?*|{}\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"
    )
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function hasAuthTokenFallback() {
  // Fallback: kolla vanliga varianter (både localStorage + cookies)
  const keys = [
    "token",
    "jwt",
    "authToken",
    "accessToken",
    "refreshToken",
    "pr_token",
    "peerrate_token",
    "peerRateToken",
    "sessionToken",
    "session",
    "pr_session",
    "connect.sid",
    "user",
    "currentUser",
  ];

  for (const k of keys) {
    try {
      const v1 = localStorage.getItem(k);
      const v2 = sessionStorage.getItem(k);
      if ((v1 && v1.length > 10) || (v2 && v2.length > 10)) return true;
    } catch (_) {}
  }

  for (const k of keys) {
    const v = getCookie(k);
    if (v && v.length > 10) return true;
  }

  return false;
}

function isLoggedIn() {
  // ✅ Primärt: det ni faktiskt använder i auth.js
  if (hasPeerRateUser()) return true;

  // ✅ Fallback: tokens/cookies
  return hasAuthTokenFallback();
}

function clearAuth() {
  // Viktigt: den ni använder i auth.js
  try { localStorage.removeItem("peerRateUser"); } catch (_) {}

  const keys = [
    "token",
    "jwt",
    "authToken",
    "accessToken",
    "refreshToken",
    "pr_token",
    "peerrate_token",
    "peerRateToken",
    "sessionToken",
    "session",
    "pr_session",
    "connect.sid",
    "user",
    "currentUser",
  ];

  for (const k of keys) {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch (_) {}
  }

  // Försök rensa cookies
  for (const k of keys) {
    document.cookie = `${k}=; Max-Age=0; path=/`;
    document.cookie = `${k}=; Max-Age=0`;
  }
}

// -----------------------------
// UI builders (dropdown content)
// -----------------------------
function setUserMenuLoggedOut(userMenu) {
  if (!userMenu) return;
  userMenu.innerHTML = `
    <a class="user-menu-link" href="/profile.html">Logga in</a>
    <a class="user-menu-link" href="/customer.html">Registrera dig</a>
  `;
}

function setUserMenuLoggedIn(userMenu) {
  if (!userMenu) return;
  userMenu.innerHTML = `
    <a class="user-menu-link" href="/profile.html">Min profil</a>
    <button type="button" id="logoutBtn">Logga ut</button>
  `;
}

function applyLoggedInState(userBtn, loggedIn) {
  if (!userBtn) return;
  userBtn.classList.toggle("is-logged-in", !!loggedIn);
}

// -----------------------------
// Core toggling
// -----------------------------
function closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn) {
  hide(menuPanel);
  hide(langMenu);
  hide(userMenu);

  setAriaExpanded(menuBtn, false);
  setAriaExpanded(langBtn, false);
  setAriaExpanded(userBtn, false);
}

function toggle(targetEl, btnEl, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn) {
  const open = !isVisible(targetEl);
  closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
  if (open) {
    show(targetEl);
    setAriaExpanded(btnEl, true);
  }
}

// -----------------------------
// Ensure userMenu exists (fixar startsidan)
// -----------------------------
function ensureUserMenu(userBtn) {
  let userMenu = pickId("userMenu");
  if (userMenu) return userMenu;
  if (!userBtn) return null;

  const parent = userBtn.parentElement; // top-actions
  if (!parent) return null;

  userMenu = document.createElement("div");
  userMenu.id = "userMenu";
  userMenu.className = "user-menu";
  userMenu.setAttribute("role", "menu");
  userMenu.setAttribute("aria-label", "Användarmeny");
  userMenu.style.display = "none";

  parent.appendChild(userMenu);
  return userMenu;
}

// -----------------------------
// Public init (idempotent)
// -----------------------------
export function initTopRow() {
  // skydd mot dubbel-init (main.js + pageBootstrap.js)
  if (window.__PR_TOPROW_INIT_DONE__) return;
  window.__PR_TOPROW_INIT_DONE__ = true;

  const menuBtn = pickId("menuBtn");
  const menuPanel = pickId("menuPanel");

  const langBtn = pickId("langBtn");
  const langMenu = pickId("langMenu");

  const userBtn = pickId("topUserPill", "topUserBtn");
  const userMenu = ensureUserMenu(userBtn);

  // Gör userBtn “klickbar” även om det är en div på någon sida
  if (userBtn) {
    userBtn.style.pointerEvents = "auto";
    userBtn.style.cursor = "pointer";

    if (!userBtn.getAttribute("role")) userBtn.setAttribute("role", "button");
    if (!userBtn.getAttribute("tabindex")) userBtn.setAttribute("tabindex", "0");
  }

  // 1) Bygg userMenu utifrån login-status (smart meny)
  const loggedIn = isLoggedIn();
  applyLoggedInState(userBtn, loggedIn);

  if (userMenu) {
    if (loggedIn) setUserMenuLoggedIn(userMenu);
    else setUserMenuLoggedOut(userMenu);
    hide(userMenu);
  }

  // 2) Bind toggles
  if (menuBtn && menuPanel) {
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(menuPanel, menuBtn, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(langMenu, langBtn, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  if (userBtn && userMenu) {
    userBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(userMenu, userBtn, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });

    userBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggle(userMenu, userBtn, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
      }
    });
  }

  // 3) Klick i userMenu: logout / links
  if (userMenu) {
    userMenu.addEventListener("click", (e) => {
      const logoutBtn = e.target.closest("#logoutBtn");
      const link = e.target.closest("a");

      if (link) {
        closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
        return;
      }

      if (logoutBtn) {
        e.preventDefault();
        clearAuth();
        applyLoggedInState(userBtn, false);
        setUserMenuLoggedOut(userMenu);
        closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
        window.location.href = "/profile.html";
      }
    });
  }

  // 4) Klick utanför → stäng allt
  document.addEventListener("click", () => {
    closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
  });

  // 5) ESC → stäng
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    }
  });

  // 6) Klick på meny-länk i hamburgarpanel → stäng panel
  if (menuPanel) {
    menuPanel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  // 7) Klick på språkval → stäng
  if (langMenu) {
    langMenu.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-lang]");
      if (b) closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }
}
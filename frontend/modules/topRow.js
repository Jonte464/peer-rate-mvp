// frontend/modules/topRow.js
// Universell funktionalitet för Top Row (hamburgare + språk + user/gubbe + login/logout)
// ✅ Idempotent: kan köras flera gånger (t.ex. om header injiceras efter att någon bootstrap redan körts)
// ✅ Strict login-status för UI: baseras ENDAST på localStorage "peerRateUser"
// ✅ Extra robust: om init körs innan top-row injiceras, sätter vi en engångs-observer som re-init:ar när DOM finns

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
// Auth helpers (STRICT)
// -----------------------------
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ✅ Vi utgår från ert riktiga auth-lager (frontend/modules/auth.js):
// localStorage key = "peerRateUser"
function getPeerRateUser() {
  try {
    const raw = localStorage.getItem("peerRateUser");
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed) return null;
    // minimikrav
    if (parsed.email || parsed.id) return parsed;
    return null;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  // ✅ Enda källan vi litar på för “inloggad” i UI:
  return !!getPeerRateUser();
}

function clearAuth() {
  // Viktigast
  try {
    localStorage.removeItem("peerRateUser");
  } catch (_) {}

  // Extra: rensa ev gamla nycklar (ofarligt men minskar spök-inloggning)
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

  // Försök rensa cookies (best-effort)
  for (const k of keys) {
    try {
      document.cookie = `${k}=; Max-Age=0; path=/`;
      document.cookie = `${k}=; Max-Age=0`;
    } catch (_) {}
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
  // ✅ Detta styr grön dot via CSS
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
// Ensure userMenu exists
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
// Engångs-observer: om init körs före injection
// -----------------------------
function ensureInitWhenReady() {
  if (document.documentElement.dataset.prTopRowObserver) return;
  document.documentElement.dataset.prTopRowObserver = "1";

  const obs = new MutationObserver(() => {
    // När top-row väl finns → init igen och stäng observern
    if (pickId("menuBtn") || pickId("langBtn") || pickId("topUserBtn") || pickId("topUserPill")) {
      try {
        initTopRow();
      } catch (_) {}
      obs.disconnect();
      delete document.documentElement.dataset.prTopRowObserver;
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
}

// -----------------------------
// Public init (IDEMPOTENT)
// -----------------------------
export function initTopRow() {
  const menuBtn = pickId("menuBtn");
  const menuPanel = pickId("menuPanel");

  const langBtn = pickId("langBtn");
  const langMenu = pickId("langMenu");

  const userBtn = pickId("topUserPill", "topUserBtn");
  const userMenu = ensureUserMenu(userBtn);

  // Om Top Row inte är injicerad än: gör inget nu, men säkerställ att vi init:ar senare.
  if (!menuBtn && !langBtn && !userBtn) {
    ensureInitWhenReady();
    return;
  }

  // Gör userBtn “klickbar” även om det blir div någon gång
  if (userBtn) {
    userBtn.style.pointerEvents = "auto";
    userBtn.style.cursor = "pointer";
    if (!userBtn.getAttribute("role")) userBtn.setAttribute("role", "button");
    if (!userBtn.getAttribute("tabindex")) userBtn.setAttribute("tabindex", "0");
  }

  // 1) Rendera userMenu baserat på login-status (varje init)
  const loggedIn = isLoggedIn();

  // ✅ Viktigt: vid init sätter vi ALLTID state (så dot inte kan “hänga kvar”)
  applyLoggedInState(userBtn, loggedIn);

  if (userMenu) {
    if (loggedIn) setUserMenuLoggedIn(userMenu);
    else setUserMenuLoggedOut(userMenu);
    hide(userMenu);
  }

  // 2) Bind toggles (bara en gång per element)
  if (menuBtn && menuPanel && !menuBtn.dataset.prBound) {
    menuBtn.dataset.prBound = "1";
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(menuPanel, menuBtn, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  if (langBtn && langMenu && !langBtn.dataset.prBound) {
    langBtn.dataset.prBound = "1";
    langBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(langMenu, langBtn, menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  if (userBtn && userMenu && !userBtn.dataset.prBound) {
    userBtn.dataset.prBound = "1";

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

  // 3) Klick i userMenu: logout / links (bind en gång på userMenu)
  if (userMenu && !userMenu.dataset.prBound) {
    userMenu.dataset.prBound = "1";

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

        // ✅ uppdatera UI direkt
        applyLoggedInState(userBtn, false);
        setUserMenuLoggedOut(userMenu);

        closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
        window.location.href = "/profile.html";
      }
    });
  }

  // 4) Klick utanför → stäng (bind en gång globalt)
  if (!document.documentElement.dataset.prTopRowDocClick) {
    document.documentElement.dataset.prTopRowDocClick = "1";
    document.addEventListener("click", () => {
      closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  // 5) ESC → stäng (bind en gång globalt)
  if (!document.documentElement.dataset.prTopRowEsc) {
    document.documentElement.dataset.prTopRowEsc = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
      }
    });
  }

  // 6) Klick på meny-länk i hamburgarpanel → stäng (bind en gång per panel)
  if (menuPanel && !menuPanel.dataset.prBound) {
    menuPanel.dataset.prBound = "1";
    menuPanel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }

  // 7) Klick på språkval → stäng (bind en gång per menu)
  if (langMenu && !langMenu.dataset.prBound) {
    langMenu.dataset.prBound = "1";
    langMenu.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-lang]");
      if (b) closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
    });
  }
}
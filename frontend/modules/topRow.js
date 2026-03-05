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

// --- Auth helpers ---------------------------------------------------------

function getCookie(name) {
  const m = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([$?*|{}\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"
    )
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function hasAuthToken() {
  // Leta brett – vi vill inte låsa oss vid exakt nyckel
  const keys = [
    "token",
    "jwt",
    "authToken",
    "accessToken",
    "pr_token",
    "peerrate_token",
    "peerRateToken",
    "sessionToken",
    "session",
  ];

  // localStorage
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k);
      if (v && v.length > 10) return true;
    } catch (_) {}
  }

  // cookies
  for (const k of keys) {
    const v = getCookie(k);
    if (v && v.length > 10) return true;
  }

  return false;
}

function clearAuth() {
  const keys = [
    "token",
    "jwt",
    "authToken",
    "accessToken",
    "pr_token",
    "peerrate_token",
    "peerRateToken",
    "sessionToken",
    "session",
  ];

  for (const k of keys) {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch (_) {}
  }

  // Försök rensa cookies (både path=/ och default)
  for (const k of keys) {
    document.cookie = `${k}=; Max-Age=0; path=/`;
    document.cookie = `${k}=; Max-Age=0`;
  }
}

// --- UI builders ----------------------------------------------------------

function setUserMenuLoggedOut(userMenu) {
  if (!userMenu) return;
  userMenu.innerHTML = `
    <a class="menu-link" href="/profile.html" style="display:flex;justify-content:space-between;align-items:center;">
      <div>Logga in</div><span>→</span>
    </a>
    <a class="menu-link" href="/customer.html" style="display:flex;justify-content:space-between;align-items:center;">
      <div>Registrera dig</div><span>→</span>
    </a>
  `;
}

function setUserMenuLoggedIn(userMenu) {
  if (!userMenu) return;
  userMenu.innerHTML = `
    <a class="menu-link" href="/profile.html" style="display:flex;justify-content:space-between;align-items:center;">
      <div>Min profil</div><span>→</span>
    </a>

    <button type="button" id="logoutBtn" style="
      width:100%;
      text-align:left;
      border:0;
      background:transparent;
      padding: 10px 10px;
      border-radius: 10px;
      cursor:pointer;
      font-weight: 750;
    ">Logga ut</button>
  `;
}

function applyLoggedInState(userBtn, loggedIn) {
  if (!userBtn) return;
  // CSS kan visa grön dot när denna klass finns
  userBtn.classList.toggle("is-logged-in", !!loggedIn);
}

// --- Core toggling logic --------------------------------------------------

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

// --- Public init ----------------------------------------------------------

export function initTopRow() {
  // Stöd både nya och gamla id:n (för att inte råka bryta någon sida)
  const menuBtn = pickId("menuBtn");
  const menuPanel = pickId("menuPanel");

  const langBtn = pickId("langBtn");
  const langMenu = pickId("langMenu");

  // Nya: topUserPill. Gamla: topUserBtn
  const userBtn = pickId("topUserPill", "topUserBtn");
  const userMenu = pickId("userMenu");

  // 1) Bygg userMenu utifrån login-status
  const loggedIn = hasAuthToken();
  applyLoggedInState(userBtn, loggedIn);

  if (userMenu) {
    if (loggedIn) setUserMenuLoggedIn(userMenu);
    else setUserMenuLoggedOut(userMenu);

    // default: stängd
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
  }

  // 3) Klick i userMenu: hantera logout om knappen finns
  if (userMenu) {
    userMenu.addEventListener("click", (e) => {
      const logoutBtn = e.target.closest("#logoutBtn");
      const link = e.target.closest("a");

      // Klick på länk → stäng menyer (navigering sker ändå)
      if (link) {
        closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);
        return;
      }

      // Klick på logout
      if (logoutBtn) {
        e.preventDefault();
        clearAuth();
        applyLoggedInState(userBtn, false);
        setUserMenuLoggedOut(userMenu);
        closeAll(menuPanel, langMenu, userMenu, menuBtn, langBtn, userBtn);

        // Skicka användaren till profile/login (enkel och tydlig UX)
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
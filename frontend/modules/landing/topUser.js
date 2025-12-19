// frontend/modules/landing/topUser.js
export function initialsFromString(str) {
  const s = String(str || '').trim();
  if (!s) return null;

  if (s.includes('@')) {
    const left = s.split('@')[0] || '';
    const parts = left.replace(/[._-]+/g, ' ').split(' ').filter(Boolean);
    const a = (parts[0]?.[0] || left[0] || '').toUpperCase();
    const b = (parts[1]?.[0] || left[1] || '').toUpperCase();
    const out = (a + b).replace(/[^A-ZÅÄÖ]/g, '');
    return out || null;
  }

  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || '').toUpperCase();
  const b = (parts[1]?.[0] || '').toUpperCase();
  const out = (a + b).replace(/[^A-ZÅÄÖ]/g, '');
  return out || null;
}

export function extractUserLabel(user) {
  if (!user) return null;
  return (
    user.fullName ||
    user.name ||
    user.displayName ||
    user.email ||
    user.user?.email ||
    user.user?.name ||
    null
  );
}

export function getFallbackUserLabelFromStorage() {
  const candidates = [
    'peerRateUser',
    'peerRateAuthUser',
    'peerRateCurrentUser',
    'peerRateUserEmail',
    'peerRateToken',
    'peerRateAccessToken',
    'peerRateRefreshToken',
    'pr_user',
    'user',
    'authUser'
  ];

  for (const k of candidates) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;

    if (raw.includes('@') && raw.length < 200) return raw;

    try {
      const obj = JSON.parse(raw);
      const found =
        obj?.fullName ||
        obj?.name ||
        obj?.displayName ||
        obj?.email ||
        obj?.user?.email ||
        obj?.user?.name ||
        null;
      if (found) return found;
    } catch (_) {}
  }
  return null;
}

export function updateTopUserPill(user) {
  const pill = document.getElementById('topUserPill');
  const initialsEl = document.getElementById('topUserInitials');
  if (!pill || !initialsEl) return;

  const label = extractUserLabel(user);
  const label2 = label || getFallbackUserLabelFromStorage();
  const ini = initialsFromString(label2);

  if (ini) {
    initialsEl.textContent = ini;
    pill.style.display = 'inline-flex';
    pill.setAttribute('aria-label', 'Inloggad: ' + ini);
    pill.title = 'Inloggad: ' + ini;
  } else {
    pill.style.display = 'none';
  }
}

export function safeLogout(auth) {
  try {
    if (auth && typeof auth.logout === 'function') { auth.logout(); return true; }
    if (auth && typeof auth.clearUser === 'function') { auth.clearUser(); return true; }
  } catch (_) {}

  const keys = [
    'peerRateAuthUser',
    'peerRateUser',
    'peerRateCurrentUser',
    'peerRateUserEmail',
    'peerRateToken',
    'peerRateAccessToken',
    'peerRateRefreshToken',
    'authToken',
    'token',
    'jwt',
    'pr_user',
    'user',
    'authUser'
  ];
  keys.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  return true;
}

export function initUserDropdown({ auth, onAfterLogout, getUser }) {
  const pill = document.getElementById('topUserPill');
  const menu = document.getElementById('userMenu');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!pill || !menu || !logoutBtn) return;

  const setOpen = (open) => {
    menu.style.display = open ? 'block' : 'none';
    pill.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  let open = false;
  const canShow = () => (pill.style.display !== 'none');

  pill.addEventListener('click', () => {
    if (!canShow()) return;
    open = !open;
    setOpen(open);
  });

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(false);

    safeLogout(auth);

    if (typeof onAfterLogout === 'function') onAfterLogout();
    window.location.href = '/';
  });

  window.addEventListener('click', (e) => {
    if (!open) return;
    if (e.target.closest('#topUserPill') || e.target.closest('#userMenu')) return;
    open = false;
    setOpen(false);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!open) return;
    open = false;
    setOpen(false);
  });

  window.addEventListener('storage', () => {
    const u2 = getUser?.() || null;
    updateTopUserPill(u2);
    if (!extractUserLabel(u2) && !getFallbackUserLabelFromStorage()) {
      open = false;
      setOpen(false);
    }
  });

  setOpen(false);
}

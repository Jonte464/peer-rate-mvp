// auth.js - Hanterar användarens autentisering och lagring
// NYTT:
// - synkar inloggad PeerRate-identitet till browser extensionen
// - rensar extension-identitet vid logout

import api from './api.js';

function normalizeText(v) {
  return String(v || '').trim();
}

function normalizeEmail(v) {
  return normalizeText(v).toLowerCase();
}

function buildExtensionIdentityPayload(user) {
  if (!user || typeof user !== 'object') return null;

  const id =
    normalizeText(user.id) ||
    normalizeText(user.customer?.id) ||
    '';

  const email =
    normalizeEmail(user.email) ||
    normalizeEmail(user.customer?.email) ||
    normalizeEmail(user.subjectRef) ||
    normalizeEmail(user.customer?.subjectRef) ||
    '';

  const subjectRef =
    normalizeEmail(user.subjectRef) ||
    normalizeEmail(user.customer?.subjectRef) ||
    email ||
    '';

  const fullName =
    normalizeText(user.fullName) ||
    normalizeText(user.customer?.fullName) ||
    `${normalizeText(user.firstName || user.customer?.firstName)} ${normalizeText(user.lastName || user.customer?.lastName)}`.trim();

  if (!email && !subjectRef && !id) return null;

  return {
    id: id || null,
    email: email || null,
    subjectRef: subjectRef || null,
    fullName: fullName || null,
    syncedAt: new Date().toISOString(),
  };
}

function postPeerRateExtensionMessage(type, payload = {}) {
  try {
    if (typeof window === 'undefined' || typeof window.postMessage !== 'function') return;
    const origin = window.location?.origin || '*';

    window.postMessage(
      {
        type,
        payload,
      },
      origin
    );
  } catch (err) {
    console.warn('auth -> extension bridge failed', err);
  }
}

function syncAuthIdentityToExtension(user) {
  const payload = buildExtensionIdentityPayload(user);
  if (!payload) return;
  postPeerRateExtensionMessage('PEERRATE_SYNC_AUTH_IDENTITY', payload);
}

function clearAuthIdentityInExtension() {
  postPeerRateExtensionMessage('PEERRATE_CLEAR_AUTH_IDENTITY', {});
}

const auth = {
  key: 'peerRateUser',

  getUser() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    try {
      if (!user || typeof user !== 'object') return;
      localStorage.setItem(this.key, JSON.stringify(user));
      syncAuthIdentityToExtension(user);
    } catch {}
  },

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch {}

    try {
      clearAuthIdentityInExtension();
    } catch {}
  },

  async hydrateFromBackend() {
    try {
      const customer = await api.getCurrentCustomer();
      if (customer && (customer.email || customer.subjectRef || customer.id)) {
        auth.setUser({
          id: customer.id || null,
          email: customer.email || customer.subjectRef || null,
          fullName: customer.fullName || null,
          subjectRef: customer.subjectRef || customer.email || null,
        });
        return auth.getUser();
      }
      return null;
    } catch (err) {
      console.warn('auth.hydrateFromBackend failed', err);
      return null;
    }
  },

  async getResolvedUser() {
    const localUser = auth.getUser();
    if (localUser && (localUser.email || localUser.subjectRef || localUser.id)) {
      syncAuthIdentityToExtension(localUser);
      return localUser;
    }
    return auth.hydrateFromBackend();
  },

  syncToExtension() {
    const localUser = auth.getUser();
    if (localUser) syncAuthIdentityToExtension(localUser);
  }
};

// On module load: if backend set a peerRateUser cookie (from OAuth callback),
// copy it into localStorage so the existing frontend auth flow recognizes the user.
try {
  if (typeof document !== 'undefined' && document.cookie) {
    const match = document.cookie.match(/(?:^|; )peerRateUser=([^;]+)/);
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const parsed = JSON.parse(decoded);
        if (parsed) {
          auth.setUser(parsed);
        }
      } catch (e) {
        // ignore parse errors
      }

      document.cookie = 'peerRateUser=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }
} catch (e) {
  // no-op in non-browser environments
}

// Also sync any already stored user to extension on module load
try {
  const existingUser = auth.getUser();
  if (existingUser) {
    syncAuthIdentityToExtension(existingUser);
  }
} catch (e) {
  // ignore
}

// Logga in användare via API och spara användarinfo i localStorage
export async function login(email, password) {
  try {
    const res = await api.login({ email, password });

    if (res && res.ok) {
      if (res.customer) {
        auth.setUser({
          id: res.customer.id || null,
          email: res.customer.email || null,
          fullName: res.customer.fullName || null,
          subjectRef: res.customer.subjectRef || res.customer.email || null,
        });
      } else {
        // fallback: försök hämta aktuell användare från backend
        await auth.hydrateFromBackend();
      }
    }

    return res;
  } catch (err) {
    console.error('auth.login error', err);
    throw err;
  }
}

// Logga ut: rensa lokalt lagrad user
export async function logout() {
  try {
    auth.clear();
    return { ok: true };
  } catch (err) {
    console.error('auth.logout error', err);
    return { ok: false, error: 'logout_failed' };
  }
}

export default auth;
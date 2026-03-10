// auth.js - Hanterar användarens autentisering och lagring

import api from './api.js';

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
    } catch {}
  },

  clear() {
    try {
      localStorage.removeItem(this.key);
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
      return localUser;
    }
    return auth.hydrateFromBackend();
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
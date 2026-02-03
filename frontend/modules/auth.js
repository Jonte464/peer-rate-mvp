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
    localStorage.setItem(this.key, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(this.key);
  },
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
        if (parsed && !localStorage.getItem('peerRateUser')) {
          localStorage.setItem('peerRateUser', JSON.stringify(parsed));
        }
      } catch (e) {
        // ignore parse errors
      }
      // Clear the cookie so it doesn't linger (set past date)
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
    if (res && res.ok && res.customer) {
      // spara enkel kundinfo i localStorage
      auth.setUser({ id: res.customer.id, email: res.customer.email, fullName: res.customer.fullName });
      return res;
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
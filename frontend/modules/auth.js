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
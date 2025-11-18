// auth.js - Hanterar användarens autentisering och lagring

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

export default auth;
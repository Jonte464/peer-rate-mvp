// main.js - Huvudfil som importerar och startar frontend-moduler
import auth from './auth.js';
import api from './api.js';
import { el, showNotice, clearNotice } from './utils.js';
import customerForm from './customer.js';
import { updateUserBadge, updateAvatars } from './profile.js';
import { adminLoginForm, adminLogoutBtn } from './admin.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  // Använd moduler här
  const user = auth.getUser();
  updateUserBadge(user);
  updateAvatars(user);

  if (customerForm) {
    console.log('Customer form loaded');
  }

  if (adminLoginForm && adminLogoutBtn) {
    console.log('Admin functionality loaded');
  }
});
// frontend/modules/customer.js
// 2-stegsregistrering:
// Steg 1: POST /api/customers (email+password+terms)
// Steg 2: POST /api/customers (förnamn+efternamn+personnummer+adress...)
// När steg 2 är klart -> redirect till /profile.html

import { showNotification } from './utils.js';

function el(id) {
  return document.getElementById(id);
}

function notify(type, msg) {
  // återanvänd er notifieringskomponent om den finns
  if (typeof showNotification === 'function') {
    showNotification(type, msg, 'customer-notice');
    return;
  }
  const n = el('customer-notice');
  if (n) n.textContent = msg || '';
}

async function postJson(path, payload, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await resp.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      const msg = data?.error || `Serverfel (status ${resp.status})`;
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(t);
  }
}

function showStep2(email) {
  // göm steg 1, visa steg 2
  el('step1-card')?.classList.add('hidden');
  el('step2-card')?.classList.remove('hidden');

  if (email) {
    sessionStorage.setItem('peerRateRegisterEmail', email);
  }
}

function getStep2Email() {
  return (sessionStorage.getItem('peerRateRegisterEmail') || '').trim().toLowerCase();
}

function bindStep1() {
  const form = el('step1-form');
  if (!form) return;

  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notify('info', 'Skapar konto…');

    const email = (el('step1-email')?.value || '').trim().toLowerCase();
    const emailConfirm = (el('step1-email-confirm')?.value || '').trim().toLowerCase();
    const password = el('step1-password')?.value || '';
    const passwordConfirm = el('step1-password-confirm')?.value || '';
    const termsAccepted = el('step1-terms')?.checked === true;

    if (!email) return notify('error', 'Fyll i e-post.');
    if (email !== emailConfirm) return notify('error', 'E-postadresserna matchar inte.');
    if (!password || password.length < 8) return notify('error', 'Lösenord måste vara minst 8 tecken.');
    if (password !== passwordConfirm) return notify('error', 'Lösenorden matchar inte.');
    if (!termsAccepted) return notify('error', 'Du måste godkänna villkoren för att skapa konto.');

    // Steg 1 payload (din backend kräver termsAccepted=true)
    const payload = {
      email,
      emailConfirm,
      password,
      passwordConfirm,
      termsAccepted: true,
      // ni har MVP-genväg, men vi skickar explicit för att vara tydliga
      thirdPartyConsent: true,
    };

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step1 response:', res);

      notify('success', 'Konto skapat. Fortsätt med steg 2.');
      showStep2(email);
    } catch (err) {
      console.error('Step1 error:', err);
      if (err?.name === 'AbortError') return notify('error', 'Servern svarar inte (timeout). Försök igen.');
      if (err?.status === 409) return notify('error', err.message || 'Det finns redan ett konto med denna e-post.');
      return notify('error', err.message || 'Kunde inte kontakta servern. Försök igen.');
    }
  });
}

function bindStep2() {
  const form = el('step2-form');
  if (!form) return;

  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notify('info', 'Sparar profil…');

    const email = getStep2Email();
    if (!email) return notify('error', 'Saknar e-post från steg 1. Gå tillbaka och skapa konto först.');

    const firstName = (el('step2-firstName')?.value || '').trim();
    const lastName = (el('step2-lastName')?.value || '').trim();
    const personalNumber = (el('step2-personalNumber')?.value || '').trim();

    const phone = (el('step2-phone')?.value || '').trim();
    const country = (el('step2-country')?.value || '').trim();

    const addressStreet = (el('step2-addressStreet')?.value || '').trim();
    const addressZip = (el('step2-addressZip')?.value || '').trim();
    const addressCity = (el('step2-addressCity')?.value || '').trim();

    if (!firstName || firstName.length < 2) return notify('error', 'Fyll i förnamn (minst 2 tecken).');
    if (!lastName || lastName.length < 2) return notify('error', 'Fyll i efternamn (minst 2 tecken).');
    if (!personalNumber) return notify('error', 'Fyll i personnummer.');

    // Steg 2 payload (presence av personuppgifter => backend tolkar som steg 2)
    const payload = {
      firstName,
      lastName,
      personalNumber,

      email,
      emailConfirm: email,

      phone: phone || null,
      addressStreet: addressStreet || null,
      addressZip: addressZip || null,
      addressCity: addressCity || null,
      country: country || null,

      termsAccepted: true,
      thirdPartyConsent: true,
    };

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step2 response:', res);

      notify('success', 'Profil sparad!');

      // städa upp och vidare till profil
      sessionStorage.removeItem('peerRateRegisterEmail');
      window.location.href = '/profile.html';
    } catch (err) {
      console.error('Step2 error:', err);
      if (err?.name === 'AbortError') return notify('error', 'Servern svarar inte (timeout). Försök igen.');
      if (err?.status === 400) return notify('error', err.message);
      if (err?.status === 409) return notify('error', err.message || 'Konflikt: e-post/personnummer finns redan.');
      return notify('error', err.message || 'Kunde inte spara profilen. Försök igen.');
    }
  });
}

export function initCustomerPage() {
  // Om användaren redan gjort steg 1 (refresh / återkommer) -> visa steg 2 direkt
  const savedEmail = getStep2Email();
  if (savedEmail) {
    showStep2(savedEmail);
  }

  bindStep1();
  bindStep2();
}

// Auto-init
initCustomerPage();

export default initCustomerPage;
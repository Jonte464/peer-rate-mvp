// frontend/modules/customer.js
// Robust 2-stegsregistrering som funkar även om HTML-id:n varierar.

import { showNotification } from './utils.js';

function $(id) {
  return document.getElementById(id);
}

function setText(msg) {
  const a = $('customer-notice');
  const b = $('customer-status');
  if (a) a.textContent = msg || '';
  if (b) b.textContent = msg || '';
}

function notify(type, msg) {
  // Försök använda din befintliga notifiering om den finns
  try {
    if (typeof showNotification === 'function') {
      // Prova båda id:n (olika sidor använder olika)
      if ($('customer-notice')) showNotification(type, msg, 'customer-notice');
      else if ($('customer-status')) showNotification(type, msg, 'customer-status');
      else showNotification(type, msg);
      return;
    }
  } catch (_) {}

  // Fallback: skriv i textfält
  setText(msg);

  // Sista fallback: alert om inget finns
  if (!$('customer-notice') && !$('customer-status') && msg) {
    // eslint-disable-next-line no-alert
    alert(msg);
  }
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

function saveEmailForStep2(email) {
  sessionStorage.setItem('peerRateRegisterEmail', (email || '').trim().toLowerCase());
}

function getEmailForStep2() {
  return (sessionStorage.getItem('peerRateRegisterEmail') || '').trim().toLowerCase();
}

function setLockedEmailIfPresent(email) {
  const cp = $('cp-email');
  if (cp && email) cp.value = email;
}

function showStep2UI(email) {
  if (email) {
    saveEmailForStep2(email);
    setLockedEmailIfPresent(email);
  }

  // 1) Om du har card-wrappers med id:n
  const step1Card = $('step1-card');
  const step2Card = $('step2-card');
  if (step1Card && step2Card) {
    step1Card.classList.add('hidden');
    step2Card.classList.remove('hidden');
    step2Card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // 2) Om du har sektioner markerade med data-step="1"/"2"
  const step1Els = document.querySelectorAll('[data-step="1"]');
  const step2Els = document.querySelectorAll('[data-step="2"]');
  if (step1Els.length || step2Els.length) {
    step1Els.forEach((n) => n.classList.add('hidden'));
    step2Els.forEach((n) => n.classList.remove('hidden'));
    if (step2Els[0]) step2Els[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // 3) Om vi hittar step2-formuläret: scrolla dit och visa tydlig text
  const step2Form = $('step2-form') || $('complete-profile-form');
  if (step2Form) {
    // Om din nya HTML använder step1-block/step2-block
    const step1Block = $('step1-block');
    const step2Block = $('step2-block');
    if (step1Block && step2Block) {
      step1Block.classList.add('hidden');
      step2Block.classList.remove('hidden');
      step2Block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      notify('success', 'Konto skapat! Fortsätt med steg 2 nedan.');
      return;
    }

    notify('success', 'Konto skapat! Fortsätt med steg 2 nedan.');
    step2Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // 4) Annars: ingen UI-del för steg 2 hittades
  notify('success', 'Konto skapat! (Steg 2-form hittades inte på sidan – kontrollera att den finns i HTML.)');
}

function bindStep1() {
  const form =
    $('step1-form') ||
    $('customer-form'); // fallback om din gamla HTML fortfarande används

  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('');

    const email = (($('step1-email')?.value || $('email')?.value || '')).trim().toLowerCase();
    const emailConfirm = (($('step1-email-confirm')?.value || email)).trim().toLowerCase();

    const password = $('step1-password')?.value || $('password')?.value || '';
    const passwordConfirm =
      $('step1-password-confirm')?.value || $('password2')?.value || '';

    const termsAccepted =
      $('step1-terms')?.checked === true ||
      $('termsAccepted')?.checked === true;

    if (!email) return notify('error', 'Fyll i e-post.');
    if (email !== emailConfirm) return notify('error', 'E-postadresserna matchar inte.');
    if (!password || password.length < 8) return notify('error', 'Lösenord måste vara minst 8 tecken.');
    if (password !== passwordConfirm) return notify('error', 'Lösenorden matchar inte.');
    if (!termsAccepted) return notify('error', 'Du måste godkänna villkoren för att skapa konto.');

    const payload = {
      email,
      emailConfirm,
      password,
      passwordConfirm,
      termsAccepted: true,
      thirdPartyConsent: true,
    };

    console.log('DEBUG customer payload (step1):', payload);
    notify('info', 'Skapar konto…');

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step1 response:', res);

      notify('success', 'Tack! Konto skapat.');
      showStep2UI(email);
    } catch (err) {
      console.error('Step1 error:', err);
      if (err?.name === 'AbortError') return notify('error', 'Servern svarar inte (timeout). Försök igen.');
      if (err?.status === 409) return notify('error', err.message || 'Det finns redan ett konto med denna e-post.');
      return notify('error', err.message || 'Kunde inte kontakta servern. Försök igen.');
    }
  });
}

function bindStep2() {
  // ✅ Stöd både gamla och nya id:n
  const form = $('step2-form') || $('complete-profile-form');
  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('');

    const email = getEmailForStep2();
    if (!email) return notify('error', 'Saknar e-post från steg 1. Gör steg 1 först.');
    setLockedEmailIfPresent(email);

    // ✅ Läs från både gamla step2-* och nya fält-id:n
    const firstName = (($('step2-firstName')?.value || $('firstName')?.value || '')).trim();
    const lastName = (($('step2-lastName')?.value || $('lastName')?.value || '')).trim();
    const personalNumber = (($('step2-personalNumber')?.value || $('personalNumber')?.value || '')).trim();

    const phone = (($('step2-phone')?.value || $('phone')?.value || '')).trim();

    // Adress: gamla fält eller nya
    const country = (($('step2-country')?.value || '')).trim();

    const addressStreet = (($('step2-addressStreet')?.value || $('address1')?.value || '')).trim();
    const addressZip = (($('step2-addressZip')?.value || $('postalCode')?.value || '')).trim();
    const addressCity = (($('step2-addressCity')?.value || $('city')?.value || '')).trim();

    if (!firstName || firstName.length < 2) return notify('error', 'Fyll i förnamn (minst 2 tecken).');
    if (!lastName || lastName.length < 2) return notify('error', 'Fyll i efternamn (minst 2 tecken).');
    if (!personalNumber) return notify('error', 'Fyll i personnummer.');

    // Om vi har nya UI:t för adress: gör dem obligatoriska där
    // (Saknas de i gamla UI:t så skickas null och backend får avgöra.)
    const hasNewAddressUI = !!$('address1') || !!$('postalCode') || !!$('city');
    if (hasNewAddressUI) {
      if (!addressStreet) return notify('error', 'Fyll i adress.');
      if (!addressZip) return notify('error', 'Fyll i postnummer.');
      if (!addressCity) return notify('error', 'Fyll i ort.');
    }

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

    console.log('DEBUG customer payload (step2):', payload);
    notify('info', 'Sparar profil…');

    try {
      // ✅ Ni har beslutat att /api/customers används för steg 1 + 2
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step2 response:', res);

      notify('success', 'Profil sparad!');
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
  // Om man laddar om mitt i steg 2: försök visa steg 2
  const saved = getEmailForStep2();
  if (saved) showStep2UI(saved);

  bindStep1();
  bindStep2();
}

// Bakåtkompatibilitet: din main.js kan importera initCustomerForm
export function initCustomerForm() {
  return initCustomerPage();
}

// Auto-init
initCustomerPage();

export default initCustomerPage;
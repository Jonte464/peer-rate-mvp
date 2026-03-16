// frontend/modules/customer.js
// Robust 2-stegsregistrering med i18n-stöd och språkbyte utan reload.
// NYTT:
// - skickar privacyAccepted till backend
// - skickar versionsspårning för terms/privacy
// - skickar registrationMethod i steg 1
// - steg 2 skriver inte längre om registreringsaudit i onödan

import { showNotification } from './utils.js';
import { t, applyLang, getCurrentLanguage } from './landing/language.js';

const TERMS_VERSION = '2026-03-16-v1';
const PRIVACY_VERSION = '2026-03-16-v1';
const REGISTRATION_METHOD = 'email_password';

function $(id) {
  return document.getElementById(id);
}

const customerLegalCopy = {
  sv: {
    privacyConsentHtml:
      'Jag har läst <a class="legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">integritetspolicyn</a>.',
    termsConsentHtml:
      'Jag har läst <a class="legal-link" href="/terms" target="_blank" rel="noopener noreferrer">användarvillkoren</a>.',
    privacyRequired:
      'Du måste läsa och godkänna integritetspolicyn för att skapa konto.',
    termsRequired:
      'Du måste läsa och godkänna användarvillkoren för att skapa konto.',
    footerTerms: 'Allmänna villkor',
  },
  en: {
    privacyConsentHtml:
      'I have read the <a class="legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.',
    termsConsentHtml:
      'I have read the <a class="legal-link" href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>.',
    privacyRequired:
      'You must read and accept the Privacy Policy to create an account.',
    termsRequired:
      'You must read and accept the Terms to create an account.',
    footerTerms: 'Terms',
  },
};

function getCustomerLegalCopy() {
  const lang = getCurrentLanguage();
  return customerLegalCopy[lang] || customerLegalCopy.en;
}

function applyCustomerLegalLanguage() {
  const copy = getCustomerLegalCopy();

  const privacyText = $('privacyConsentText');
  const termsText = $('termsConsentText');
  const footerTermsLink = document.querySelector('footer a[href="/terms"]');

  if (privacyText) {
    privacyText.innerHTML = copy.privacyConsentHtml;
  }

  if (termsText) {
    termsText.innerHTML = copy.termsConsentHtml;
  }

  if (footerTermsLink) {
    footerTermsLink.textContent = copy.footerTerms;
  }
}

function setText(msg) {
  const a = $('customer-notice');
  const b = $('customer-status');
  const c = $('customer-status-step2');

  if (a) a.textContent = msg || '';
  if (b) b.textContent = msg || '';
  if (c) c.textContent = msg || '';
}

function notify(type, msg) {
  try {
    if (typeof showNotification === 'function') {
      if ($('customer-notice')) showNotification(type, msg, 'customer-notice');
      else if ($('customer-status')) showNotification(type, msg, 'customer-status');
      else if ($('customer-status-step2')) showNotification(type, msg, 'customer-status-step2');
      else showNotification(type, msg);
      return;
    }
  } catch (_) {}

  setText(msg);

  if (!$('customer-notice') && !$('customer-status') && !$('customer-status-step2') && msg) {
    alert(msg);
  }
}

async function postJson(path, payload, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const tmr = setTimeout(() => controller.abort(), timeoutMs);

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
      const msg = data?.error || t('customer_error_server_status', 'Server error (status {status})', { status: resp.status });
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(tmr);
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

  const step1Card = $('step1-card');
  const step2Card = $('step2-card');
  if (step1Card && step2Card) {
    step1Card.classList.add('hidden');
    step2Card.classList.remove('hidden');
    step2Card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    applyLang(document);
    applyCustomerLegalLanguage();
    return;
  }

  const step1Els = document.querySelectorAll('[data-step="1"]');
  const step2Els = document.querySelectorAll('[data-step="2"]');
  if (step1Els.length || step2Els.length) {
    step1Els.forEach((n) => n.classList.add('hidden'));
    step2Els.forEach((n) => n.classList.remove('hidden'));
    if (step2Els[0]) step2Els[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    applyLang(document);
    applyCustomerLegalLanguage();
    return;
  }

  const step2Form = $('step2-form') || $('complete-profile-form');
  if (step2Form) {
    const step1Block = $('step1-block');
    const step2Block = $('step2-block');
    if (step1Block && step2Block) {
      step1Block.classList.add('hidden');
      step2Block.classList.remove('hidden');
      step2Block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      notify('success', t('customer_step1_success_continue', 'Account created! Continue with step 2 below.'));
      applyLang(document);
      applyCustomerLegalLanguage();
      return;
    }

    notify('success', t('customer_step1_success_continue', 'Account created! Continue with step 2 below.'));
    step2Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    applyLang(document);
    applyCustomerLegalLanguage();
    return;
  }

  notify(
    'success',
    t(
      'customer_step1_success_no_step2',
      'Account created! (Step 2 form was not found on the page — check that it exists in HTML.)'
    )
  );
}

function buildStep1RegistrationAuditPayload() {
  return {
    privacyAccepted: true,
    termsAccepted: true,
    privacyVersionAccepted: PRIVACY_VERSION,
    termsVersionAccepted: TERMS_VERSION,
    registrationMethod: REGISTRATION_METHOD,
  };
}

function bindStep1() {
  const form =
    $('step1-form') ||
    $('customer-form');

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

    const privacyAccepted = $('privacyAccepted')?.checked === true;
    const termsAccepted =
      $('step1-terms')?.checked === true ||
      $('termsAccepted')?.checked === true;

    const legalCopy = getCustomerLegalCopy();

    if (!email) return notify('error', t('customer_error_fill_email', 'Please enter an email address.'));
    if (email !== emailConfirm) return notify('error', t('customer_error_email_mismatch', 'Email addresses do not match.'));
    if (!password || password.length < 8) return notify('error', t('customer_error_password_length', 'Password must be at least 8 characters.'));
    if (password !== passwordConfirm) return notify('error', t('customer_error_password_mismatch', 'Passwords do not match.'));
    if (!privacyAccepted) return notify('error', legalCopy.privacyRequired);
    if (!termsAccepted) return notify('error', legalCopy.termsRequired);

    const payload = {
      email,
      emailConfirm,
      password,
      passwordConfirm,
      thirdPartyConsent: true,
      ...buildStep1RegistrationAuditPayload(),
    };

    console.log('DEBUG customer payload (step1):', payload);
    notify('info', t('customer_status_creating_account', 'Creating account…'));

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step1 response:', res);

      notify('success', t('customer_step1_success', 'Thanks! Account created.'));
      showStep2UI(email);
    } catch (err) {
      console.error('Step1 error:', err);
      if (err?.name === 'AbortError') return notify('error', t('customer_error_timeout', 'The server is not responding (timeout). Please try again.'));
      if (err?.status === 409) return notify('error', err.message || t('customer_error_email_exists', 'An account with this email already exists.'));
      return notify('error', err.message || t('customer_error_contact_server', 'Could not contact the server. Please try again.'));
    }
  });
}

function bindStep2() {
  const form = $('step2-form') || $('complete-profile-form');
  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('');

    const email = getEmailForStep2();
    if (!email) return notify('error', t('customer_error_missing_step1_email', 'Missing email from step 1. Please complete step 1 first.'));
    setLockedEmailIfPresent(email);

    const firstName = (($('step2-firstName')?.value || $('firstName')?.value || '')).trim();
    const lastName = (($('step2-lastName')?.value || $('lastName')?.value || '')).trim();
    const personalNumber = (($('step2-personalNumber')?.value || $('personalNumber')?.value || '')).trim();

    const phone = (($('step2-phone')?.value || $('phone')?.value || '')).trim();
    const country = (($('step2-country')?.value || '')).trim();

    const addressStreet = (($('step2-addressStreet')?.value || $('address1')?.value || '')).trim();
    const addressZip = (($('step2-addressZip')?.value || $('postalCode')?.value || '')).trim();
    const addressCity = (($('step2-addressCity')?.value || $('city')?.value || '')).trim();

    if (!firstName || firstName.length < 2) return notify('error', t('customer_error_first_name', 'Please enter first name (at least 2 characters).'));
    if (!lastName || lastName.length < 2) return notify('error', t('customer_error_last_name', 'Please enter last name (at least 2 characters).'));
    if (!personalNumber) return notify('error', t('customer_error_personal_number', 'Please enter personal number.'));

    const hasNewAddressUI = !!$('address1') || !!$('postalCode') || !!$('city');
    if (hasNewAddressUI) {
      if (!addressStreet) return notify('error', t('customer_error_address', 'Please enter address.'));
      if (!addressZip) return notify('error', t('customer_error_postal_code', 'Please enter postal code.'));
      if (!addressCity) return notify('error', t('customer_error_city', 'Please enter city.'));
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
      thirdPartyConsent: true,
    };

    console.log('DEBUG customer payload (step2):', payload);
    notify('info', t('customer_status_saving_profile', 'Saving profile…'));

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step2 response:', res);

      notify('success', t('customer_step2_success', 'Profile saved!'));
      sessionStorage.removeItem('peerRateRegisterEmail');
      window.location.href = '/profile.html';
    } catch (err) {
      console.error('Step2 error:', err);
      if (err?.name === 'AbortError') return notify('error', t('customer_error_timeout', 'The server is not responding (timeout). Please try again.'));
      if (err?.status === 400) return notify('error', err.message);
      if (err?.status === 409) return notify('error', err.message || t('customer_error_conflict', 'Conflict: email/personal number already exists.'));
      return notify('error', err.message || t('customer_error_save_profile', 'Could not save the profile. Please try again.'));
    }
  });
}

function bindLanguageChangeHandler() {
  if (window.__peerRateCustomerLangBound) return;
  window.__peerRateCustomerLangBound = true;

  window.addEventListener('peerrate:language-changed', () => {
    applyLang(document);
    applyCustomerLegalLanguage();
  });
}

export function initCustomerPage() {
  bindLanguageChangeHandler();

  const saved = getEmailForStep2();
  if (saved) showStep2UI(saved);

  bindStep1();
  bindStep2();
  applyLang(document);
  applyCustomerLegalLanguage();
}

export function initCustomerForm() {
  return initCustomerPage();
}

initCustomerPage();

export default initCustomerPage;
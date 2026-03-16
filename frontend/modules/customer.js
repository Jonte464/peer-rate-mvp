// frontend/modules/customer.js
// Robust 2-stegsregistrering med i18n-stöd och språkbyte utan reload.
// NYTT:
// - tydligare användarmeddelanden
// - felkod + tydlig text till användaren
// - success-notis som faktiskt syns
// - bättre steg 2-feedback
// - tydligare redirect efter lyckad profilkomplettering

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

function formatMessageWithCode(message, errorCode) {
  if (!message) return '';
  if (!errorCode) return message;
  return `${message} (Kod: ${errorCode})`;
}

function notify(type, msg, errorCode = null) {
  const finalMessage = formatMessageWithCode(msg, errorCode);

  try {
    if (typeof showNotification === 'function') {
      showNotification(type, finalMessage, 'customer-notice');
      return;
    }
  } catch (_) {}

  setText(finalMessage);

  if (msg) {
    alert(finalMessage);
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
      const msg =
        data?.error ||
        t('customer_error_server_status', 'Serverfel (status {status})', { status: resp.status });

      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      err.errorCode = data?.errorCode || null;
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

  const step1Block = $('step1-block');
  const step2Block = $('step2-block');

  if (step1Block && step2Block) {
    step1Block.classList.add('hidden');
    step2Block.classList.remove('hidden');
    step2Block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    applyLang(document);
    applyCustomerLegalLanguage();
    return;
  }

  const step2Form = $('step2-form') || $('complete-profile-form');
  if (step2Form) {
    step2Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    applyLang(document);
    applyCustomerLegalLanguage();
  }
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

    if (!email) return notify('error', 'Du måste ange en e-postadress.', 'EMAIL_REQUIRED');
    if (email !== emailConfirm) return notify('error', 'E-postadresserna matchar inte.', 'EMAIL_MISMATCH');
    if (!password || password.length < 8) return notify('error', 'Lösenordet måste vara minst 8 tecken långt.', 'PASSWORD_TOO_SHORT');
    if (password !== passwordConfirm) return notify('error', 'Lösenorden matchar inte.', 'PASSWORD_MISMATCH');
    if (!privacyAccepted) return notify('error', legalCopy.privacyRequired, 'PRIVACY_REQUIRED');
    if (!termsAccepted) return notify('error', legalCopy.termsRequired, 'TERMS_REQUIRED');

    const payload = {
      email,
      emailConfirm,
      password,
      passwordConfirm,
      thirdPartyConsent: true,
      ...buildStep1RegistrationAuditPayload(),
    };

    console.log('DEBUG customer payload (step1):', payload);
    notify('info', 'Skapar konto...');

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step1 response:', res);

      notify(
        'success',
        'Tack för din registrering! Steg 1 är klart. Fortsätt nu med dina profiluppgifter nedan.'
      );

      showStep2UI(email);
    } catch (err) {
      console.error('Step1 error:', err);

      if (err?.name === 'AbortError') {
        return notify('error', 'Servern svarar inte just nu. Försök igen om en liten stund.', 'REQUEST_TIMEOUT');
      }

      if (err?.status === 409) {
        return notify(
          'error',
          err.message || 'Det finns redan ett konto med denna e-postadress.',
          err.errorCode || 'EMAIL_EXISTS'
        );
      }

      return notify(
        'error',
        err.message || 'Det gick inte att skapa kontot. Försök igen.',
        err.errorCode || 'REGISTER_FAILED'
      );
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
    if (!email) {
      return notify(
        'error',
        'Steg 1 verkar inte vara klart. Börja med att skapa konto först.',
        'STEP1_MISSING'
      );
    }

    setLockedEmailIfPresent(email);

    const firstName = (($('step2-firstName')?.value || $('firstName')?.value || '')).trim();
    const lastName = (($('step2-lastName')?.value || $('lastName')?.value || '')).trim();
    const personalNumber = (($('step2-personalNumber')?.value || $('personalNumber')?.value || '')).trim();

    const phone = (($('step2-phone')?.value || $('phone')?.value || '')).trim();
    const country = (($('step2-country')?.value || '')).trim();

    const addressStreet = (($('step2-addressStreet')?.value || $('address1')?.value || '')).trim();
    const addressZip = (($('step2-addressZip')?.value || $('postalCode')?.value || '')).trim();
    const addressCity = (($('step2-addressCity')?.value || $('city')?.value || '')).trim();

    if (!firstName || firstName.length < 2) {
      return notify('error', 'Ange ett giltigt förnamn.', 'FIRST_NAME_INVALID');
    }

    if (!lastName || lastName.length < 2) {
      return notify('error', 'Ange ett giltigt efternamn.', 'LAST_NAME_INVALID');
    }

    if (!personalNumber) {
      return notify('error', 'Du måste ange personnummer.', 'PERSONAL_NUMBER_REQUIRED');
    }

    const hasNewAddressUI = !!$('address1') || !!$('postalCode') || !!$('city');
    if (hasNewAddressUI) {
      if (!addressStreet) return notify('error', 'Du måste ange adress.', 'ADDRESS_REQUIRED');
      if (!addressZip) return notify('error', 'Du måste ange postnummer.', 'POSTAL_CODE_REQUIRED');
      if (!addressCity) return notify('error', 'Du måste ange ort.', 'CITY_REQUIRED');
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
    notify('info', 'Sparar profil...');

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step2 response:', res);

      notify('success', 'Tack! Din registrering är nu klar. Du skickas vidare till din profil.');

      sessionStorage.removeItem('peerRateRegisterEmail');

      setTimeout(() => {
        window.location.href = '/profile.html';
      }, 1400);
    } catch (err) {
      console.error('Step2 error:', err);

      if (err?.name === 'AbortError') {
        return notify('error', 'Servern svarar inte just nu. Försök igen om en liten stund.', 'REQUEST_TIMEOUT');
      }

      if (err?.status === 400) {
        return notify(
          'error',
          err.message || 'Någon uppgift är ogiltig. Kontrollera formuläret och försök igen.',
          err.errorCode || 'VALIDATION_ERROR'
        );
      }

      if (err?.status === 409) {
        return notify(
          'error',
          err.message || 'Det finns redan en användare med samma e-post eller personnummer.',
          err.errorCode || 'CONFLICT'
        );
      }

      return notify(
        'error',
        err.message || 'Det gick inte att spara profilen. Försök igen.',
        err.errorCode || 'SAVE_PROFILE_FAILED'
      );
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
  if (saved) {
    showStep2UI(saved);
    notify('info', 'Du har redan skapat konto i steg 1. Fyll nu i resten av profilen.');
  }

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
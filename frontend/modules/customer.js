// frontend/modules/customer.js
// Robust 2-stegsregistrering med tydligt step-state.
// FIX:
// - auto-hoppar inte längre till steg 2 bara för att sessionStorage råkar innehålla e-post
// - använder tydligare draft-state istället för en ensam e-poststräng
// - visar steg 1 som standard
// - erbjuder frivillig "återuppta registrering" om giltigt step1-state finns
// - guard mot dubbel init
// - behåller flowStep till backend
// - tillbaka till steg 1 förstör inte längre möjligheten att återgå till steg 2

import { showNotification } from './utils.js';
import { t, applyLang, getCurrentLanguage } from './landing/language.js';

const TERMS_VERSION = '2026-03-16-v1';
const PRIVACY_VERSION = '2026-03-16-v1';
const REGISTRATION_METHOD = 'email_password';

const REGISTRATION_DRAFT_KEY = 'peerRateRegistrationDraft';
const REGISTRATION_DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 timmar

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
    resumeTitle: 'Tidigare registrering hittad',
    resumeText: 'Vi hittade en påbörjad registrering för {email}. Vill du fortsätta i steg 2 eller börja om från steg 1?',
    resumeContinue: 'Fortsätt till steg 2',
    resumeRestart: 'Börja om',
    backToStep1: 'Tillbaka till steg 1',
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
    resumeTitle: 'Previous registration found',
    resumeText: 'We found a started registration for {email}. Do you want to continue with step 2 or start over from step 1?',
    resumeContinue: 'Continue to step 2',
    resumeRestart: 'Start over',
    backToStep1: 'Back to step 1',
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

  updateBackButtonLabel();
  renderResumePromptIfNeeded();
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function saveRegistrationDraft(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const payload = {
    email: normalizedEmail,
    step1Completed: true,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(payload));
  } catch {}
}

function getRegistrationDraft() {
  try {
    const raw = sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const email = normalizeEmail(parsed?.email);
    const step1Completed = parsed?.step1Completed === true;
    const savedAt = Number(parsed?.savedAt || 0);

    if (!email || !isValidEmail(email) || !step1Completed || !savedAt) {
      clearRegistrationDraft();
      return null;
    }

    const age = Date.now() - savedAt;
    if (age < 0 || age > REGISTRATION_DRAFT_MAX_AGE_MS) {
      clearRegistrationDraft();
      return null;
    }

    return {
      email,
      step1Completed,
      savedAt,
    };
  } catch {
    clearRegistrationDraft();
    return null;
  }
}

function clearRegistrationDraft() {
  try {
    sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
  } catch {}
}

function setLockedEmailIfPresent(email) {
  const cp = $('cp-email');
  if (cp && email) cp.value = email;
}

function clearLockedEmail() {
  const cp = $('cp-email');
  if (cp) cp.value = '';
}

function resetStep1Form() {
  const form = $('customer-form');
  if (form) form.reset();
}

function resetStep2Form({ preserveEmail = false } = {}) {
  const form = $('complete-profile-form');
  if (form) form.reset();
  if (!preserveEmail) clearLockedEmail();
}

function showStep1UI() {
  const step1Block = $('step1-block');
  const step2Block = $('step2-block');

  if (step2Block) step2Block.classList.add('hidden');
  if (step1Block) step1Block.classList.remove('hidden');

  try {
    step1Block?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {}

  applyLang(document);
  applyCustomerLegalLanguage();
}

function showStep2UI(email) {
  if (email) {
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

  const step2Form = $('complete-profile-form');
  if (step2Form) {
    step2Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    applyLang(document);
    applyCustomerLegalLanguage();
  }
}

function buildStep1RegistrationAuditPayload() {
  return {
    flowStep: 'step1',
    privacyAccepted: true,
    termsAccepted: true,
    privacyVersionAccepted: PRIVACY_VERSION,
    termsVersionAccepted: TERMS_VERSION,
    registrationMethod: REGISTRATION_METHOD,
  };
}

function buildBackToStep1Button() {
  const copy = getCustomerLegalCopy();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn soft-hover';
  btn.textContent = copy.backToStep1;

  btn.addEventListener('click', () => {
    showStep1UI();
    renderResumePromptIfNeeded();
    notify('info', 'Du är tillbaka i steg 1. Du kan fortsätta till steg 2 igen via rutan för tidigare registrering.');
  });

  return btn;
}

function updateBackButtonLabel() {
  const btn = $('back-to-step1-btn');
  if (!btn) return;

  const copy = getCustomerLegalCopy();
  btn.textContent = copy.backToStep1;
}

function ensureStep2BackButton() {
  const form = $('complete-profile-form');
  if (!form) return;
  if ($('back-to-step1-btn')) return;

  const actions = form.querySelector('.actions');
  if (!actions) return;

  const btn = buildBackToStep1Button();
  btn.id = 'back-to-step1-btn';
  actions.appendChild(btn);
}

function getResumePromptBox() {
  let box = $('customer-resume-box');
  if (box) return box;

  const notice = $('customer-notice');
  if (!notice || !notice.parentNode) return null;

  box = document.createElement('div');
  box.id = 'customer-resume-box';
  box.className = 'notice info';
  box.style.display = 'none';
  box.setAttribute('aria-live', 'polite');

  notice.insertAdjacentElement('afterend', box);
  return box;
}

function clearResumePrompt() {
  const box = $('customer-resume-box');
  if (!box) return;
  box.innerHTML = '';
  box.style.display = 'none';
}

function renderResumePromptIfNeeded() {
  const draft = getRegistrationDraft();
  const box = getResumePromptBox();
  if (!box) return;

  if (!draft?.email) {
    clearResumePrompt();
    return;
  }

  const copy = getCustomerLegalCopy();

  box.innerHTML = '';
  box.className = 'notice info';
  box.style.display = 'block';

  const title = document.createElement('div');
  title.style.fontWeight = '800';
  title.style.marginBottom = '6px';
  title.textContent = copy.resumeTitle;

  const text = document.createElement('div');
  text.style.marginBottom = '10px';
  text.textContent = copy.resumeText.replace('{email}', draft.email);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'btn btn-primary soft-hover';
  continueBtn.textContent = copy.resumeContinue;
  continueBtn.addEventListener('click', () => {
    clearResumePrompt();
    setLockedEmailIfPresent(draft.email);
    showStep2UI(draft.email);
    notify('info', 'Fortsätter din tidigare registrering i steg 2.');
  });

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'btn soft-hover';
  restartBtn.textContent = copy.resumeRestart;
  restartBtn.addEventListener('click', () => {
    clearRegistrationDraft();
    clearResumePrompt();
    resetStep1Form();
    resetStep2Form();
    showStep1UI();
    notify('info', 'Tidigare registrering rensad. Du kan börja om från steg 1.');
  });

  actions.appendChild(continueBtn);
  actions.appendChild(restartBtn);

  box.appendChild(title);
  box.appendChild(text);
  box.appendChild(actions);
}

function bindStep1() {
  const form = $('customer-form');
  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('');
    clearResumePrompt();

    const email = normalizeEmail($('email')?.value || '');
    const emailConfirm = email;

    const password = $('password')?.value || '';
    const passwordConfirm = $('password2')?.value || '';

    const privacyAccepted = $('privacyAccepted')?.checked === true;
    const termsAccepted = $('termsAccepted')?.checked === true;

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

      saveRegistrationDraft(email);
      setLockedEmailIfPresent(email);

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
        saveRegistrationDraft(email);
        renderResumePromptIfNeeded();

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
  const form = $('complete-profile-form');
  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('');

    const draft = getRegistrationDraft();
    const email = normalizeEmail(draft?.email || '');

    if (!email) {
      return notify(
        'error',
        'Steg 1 verkar inte vara klart. Gå tillbaka till steg 1 och skapa konto först.',
        'STEP1_MISSING'
      );
    }

    setLockedEmailIfPresent(email);

    const firstName = (($('firstName')?.value || '')).trim();
    const lastName = (($('lastName')?.value || '')).trim();
    const personalNumber = (($('personalNumber')?.value || '')).trim();

    const phone = (($('phone')?.value || '')).trim();
    const addressStreet = (($('address1')?.value || '')).trim();
    const addressZip = (($('postalCode')?.value || '')).trim();
    const addressCity = (($('city')?.value || '')).trim();

    if (!firstName || firstName.length < 2) {
      return notify('error', 'Ange ett giltigt förnamn.', 'FIRST_NAME_INVALID');
    }

    if (!lastName || lastName.length < 2) {
      return notify('error', 'Ange ett giltigt efternamn.', 'LAST_NAME_INVALID');
    }

    if (!personalNumber) {
      return notify('error', 'Du måste ange personnummer.', 'PERSONAL_NUMBER_REQUIRED');
    }

    if (!addressStreet) return notify('error', 'Du måste ange adress.', 'ADDRESS_REQUIRED');
    if (!addressZip) return notify('error', 'Du måste ange postnummer.', 'POSTAL_CODE_REQUIRED');
    if (!addressCity) return notify('error', 'Du måste ange ort.', 'CITY_REQUIRED');

    const payload = {
      flowStep: 'step2',
      firstName,
      lastName,
      personalNumber,
      email,
      emailConfirm: email,
      phone: phone || null,
      addressStreet: addressStreet || null,
      addressZip: addressZip || null,
      addressCity: addressCity || null,
      country: null,
      thirdPartyConsent: true,
    };

    console.log('DEBUG customer payload (step2):', payload);
    notify('info', 'Sparar profil...');

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step2 response:', res);

      notify('success', 'Tack! Din registrering är nu klar. Du skickas vidare till din profil.');

      clearRegistrationDraft();
      clearResumePrompt();

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
  if (window.__peerRateCustomerPageInitialized) return;
  window.__peerRateCustomerPageInitialized = true;

  bindLanguageChangeHandler();
  ensureStep2BackButton();

  showStep1UI();
  renderResumePromptIfNeeded();

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
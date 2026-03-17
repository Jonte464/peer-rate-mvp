// frontend/modules/customer.js
// Robust 2-stegsregistrering med tydligt step-state.
// FIXAR:
// - auto-hoppar inte till steg 2 bara för att sessionStorage råkar innehålla e-post
// - visar steg 1 som standard om inget aktivt steg finns
// - erbjuder frivillig "återuppta registrering" om giltigt step1-state finns
// - guard mot dubbel init
// - behåller flowStep till backend
// - tillbaka till steg 1 förstör inte längre möjligheten att återgå till steg 2
// - resume-rutan visas bara i steg 1, inte ovanpå steg 2
// - NYTT: persisterar currentStep i sessionStorage
// - NYTT: persisterar step2-utkast så att fel i steg 2 inte upplevs som reset
// - NYTT: återställer steg 2 automatiskt om användaren redan befann sig där
// - NYTT: valideringsfel i steg 2 håller användaren kvar i steg 2 med kvarfyllda fält

import { showNotification } from './utils.js';
import { t, applyLang, getCurrentLanguage } from './landing/language.js';

const TERMS_VERSION = '2026-03-16-v1';
const PRIVACY_VERSION = '2026-03-16-v1';
const REGISTRATION_METHOD = 'email_password';

const REGISTRATION_DRAFT_KEY = 'peerRateRegistrationDraft';
const REGISTRATION_DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 timmar

const CUSTOMER_FLOW_STATE_KEY = 'peerRateCustomerFlowState';
const CUSTOMER_STEP2_DRAFT_KEY = 'peerRateCustomerStep2Draft';

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
    resumeText:
      'Vi hittade en påbörjad registrering för {email}. Vill du fortsätta i steg 2 eller börja om från steg 1?',
    resumeContinue: 'Fortsätt till steg 2',
    resumeRestart: 'Börja om',
    backToStep1: 'Tillbaka till steg 1',
    backToStep1Info:
      'Du är tillbaka i steg 1. Du kan fortsätta till steg 2 igen via rutan för tidigare registrering.',
    resumedStep2Info: 'Fortsätter din tidigare registrering i steg 2.',
    restartClearedInfo: 'Tidigare registrering rensad. Du kan börja om från steg 1.',
    creatingAccount: 'Skapar konto...',
    step1Success:
      'Tack för din registrering! Steg 1 är klart. Fortsätt nu med dina profiluppgifter nedan.',
    savingProfile: 'Sparar profil...',
    step2Success: 'Tack! Din registrering är nu klar. Du skickas vidare till din profil.',
    step1Missing:
      'Steg 1 verkar inte vara klart. Gå tillbaka till steg 1 och skapa konto först.',
    emailRequired: 'Du måste ange en e-postadress.',
    emailMismatch: 'E-postadresserna matchar inte.',
    passwordTooShort: 'Lösenordet måste vara minst 8 tecken långt.',
    passwordMismatch: 'Lösenorden matchar inte.',
    firstNameInvalid: 'Ange ett giltigt förnamn.',
    lastNameInvalid: 'Ange ett giltigt efternamn.',
    personalNumberRequired: 'Du måste ange personnummer.',
    addressRequired: 'Du måste ange adress.',
    postalCodeRequired: 'Du måste ange postnummer.',
    cityRequired: 'Du måste ange ort.',
    timeout: 'Servern svarar inte just nu. Försök igen om en liten stund.',
    emailExists: 'Det finns redan ett konto med denna e-postadress.',
    registerFailed: 'Det gick inte att skapa kontot. Försök igen.',
    validationFailed: 'Någon uppgift är ogiltig. Kontrollera formuläret och försök igen.',
    conflict: 'Det finns redan en användare med samma e-post eller personnummer.',
    saveProfileFailed: 'Det gick inte att spara profilen. Försök igen.',
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
    resumeText:
      'We found a started registration for {email}. Do you want to continue with step 2 or start over from step 1?',
    resumeContinue: 'Continue to step 2',
    resumeRestart: 'Start over',
    backToStep1: 'Back to step 1',
    backToStep1Info:
      'You are back in step 1. You can continue to step 2 again via the previous registration box.',
    resumedStep2Info: 'Continuing your previous registration in step 2.',
    restartClearedInfo: 'Previous registration cleared. You can start over from step 1.',
    creatingAccount: 'Creating account...',
    step1Success:
      'Thank you for registering! Step 1 is complete. Please continue with your profile details below.',
    savingProfile: 'Saving profile...',
    step2Success: 'Thank you! Your registration is now complete. Redirecting to your profile.',
    step1Missing:
      'Step 1 does not seem complete. Please go back to step 1 and create your account first.',
    emailRequired: 'You must enter an email address.',
    emailMismatch: 'The email addresses do not match.',
    passwordTooShort: 'Password must be at least 8 characters long.',
    passwordMismatch: 'The passwords do not match.',
    firstNameInvalid: 'Enter a valid first name.',
    lastNameInvalid: 'Enter a valid last name.',
    personalNumberRequired: 'You must enter a personal number.',
    addressRequired: 'You must enter an address.',
    postalCodeRequired: 'You must enter a postal code.',
    cityRequired: 'You must enter a city.',
    timeout: 'The server is not responding right now. Please try again shortly.',
    emailExists: 'An account with this email already exists.',
    registerFailed: 'Could not create the account. Please try again.',
    validationFailed: 'Some information is invalid. Please review the form and try again.',
    conflict: 'A user with the same email or personal number already exists.',
    saveProfileFailed: 'Could not save the profile. Please try again.',
  },
};

function getCustomerLegalCopy() {
  const lang = getCurrentLanguage();
  return customerLegalCopy[lang] || customerLegalCopy.en;
}

function isStep1Visible() {
  const step1 = $('step1-block');
  return !!step1 && !step1.classList.contains('hidden');
}

function isStep2Visible() {
  const step2 = $('step2-block');
  return !!step2 && !step2.classList.contains('hidden');
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

function saveFlowState(step, email = null) {
  try {
    sessionStorage.setItem(
      CUSTOMER_FLOW_STATE_KEY,
      JSON.stringify({
        currentStep: step,
        email: normalizeEmail(email || ''),
        savedAt: Date.now(),
      })
    );
  } catch {}
}

function getFlowState() {
  try {
    const raw = sessionStorage.getItem(CUSTOMER_FLOW_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const currentStep = parsed?.currentStep === 'step2' ? 'step2' : 'step1';
    const email = normalizeEmail(parsed?.email || '');
    const savedAt = Number(parsed?.savedAt || 0);

    if (!savedAt) {
      clearFlowState();
      return null;
    }

    const age = Date.now() - savedAt;
    if (age < 0 || age > REGISTRATION_DRAFT_MAX_AGE_MS) {
      clearFlowState();
      return null;
    }

    return {
      currentStep,
      email,
      savedAt,
    };
  } catch {
    clearFlowState();
    return null;
  }
}

function clearFlowState() {
  try {
    sessionStorage.removeItem(CUSTOMER_FLOW_STATE_KEY);
  } catch {}
}

function readStep2DraftFromForm() {
  return {
    firstName: (($('firstName')?.value || '')).trim(),
    lastName: (($('lastName')?.value || '')).trim(),
    personalNumber: (($('personalNumber')?.value || '')).trim(),
    phone: (($('phone')?.value || '')).trim(),
    addressStreet: (($('address1')?.value || '')).trim(),
    addressZip: (($('postalCode')?.value || '')).trim(),
    addressCity: (($('city')?.value || '')).trim(),
  };
}

function saveStep2Draft(partial = {}) {
  const draft = getRegistrationDraft();
  const email = normalizeEmail(partial.email || draft?.email || '');
  if (!email) return;

  const payload = {
    email,
    firstName: partial.firstName ?? (($('firstName')?.value || '')).trim(),
    lastName: partial.lastName ?? (($('lastName')?.value || '')).trim(),
    personalNumber: partial.personalNumber ?? (($('personalNumber')?.value || '')).trim(),
    phone: partial.phone ?? (($('phone')?.value || '')).trim(),
    addressStreet: partial.addressStreet ?? (($('address1')?.value || '')).trim(),
    addressZip: partial.addressZip ?? (($('postalCode')?.value || '')).trim(),
    addressCity: partial.addressCity ?? (($('city')?.value || '')).trim(),
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(CUSTOMER_STEP2_DRAFT_KEY, JSON.stringify(payload));
  } catch {}
}

function getStep2Draft() {
  try {
    const raw = sessionStorage.getItem(CUSTOMER_STEP2_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const email = normalizeEmail(parsed?.email || '');
    const savedAt = Number(parsed?.savedAt || 0);

    if (!savedAt) {
      clearStep2Draft();
      return null;
    }

    const age = Date.now() - savedAt;
    if (age < 0 || age > REGISTRATION_DRAFT_MAX_AGE_MS) {
      clearStep2Draft();
      return null;
    }

    return {
      email,
      firstName: String(parsed?.firstName || ''),
      lastName: String(parsed?.lastName || ''),
      personalNumber: String(parsed?.personalNumber || ''),
      phone: String(parsed?.phone || ''),
      addressStreet: String(parsed?.addressStreet || ''),
      addressZip: String(parsed?.addressZip || ''),
      addressCity: String(parsed?.addressCity || ''),
      savedAt,
    };
  } catch {
    clearStep2Draft();
    return null;
  }
}

function clearStep2Draft() {
  try {
    sessionStorage.removeItem(CUSTOMER_STEP2_DRAFT_KEY);
  } catch {}
}

function fillStep2FormFromDraft() {
  const draft = getStep2Draft();
  if (!draft) return;

  if ($('firstName')) $('firstName').value = draft.firstName || '';
  if ($('lastName')) $('lastName').value = draft.lastName || '';
  if ($('personalNumber')) $('personalNumber').value = draft.personalNumber || '';
  if ($('phone')) $('phone').value = draft.phone || '';
  if ($('address1')) $('address1').value = draft.addressStreet || '';
  if ($('postalCode')) $('postalCode').value = draft.addressZip || '';
  if ($('city')) $('city').value = draft.addressCity || '';
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

  clearLockedEmail();
  saveFlowState('step1');

  try {
    step1Block?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {}

  applyLang(document);
  applyCustomerLegalLanguage();
  renderResumePromptIfNeeded();
}

function showStep2UI(email, { restoreDraft = true } = {}) {
  if (email) {
    setLockedEmailIfPresent(email);
  }

  const step1Block = $('step1-block');
  const step2Block = $('step2-block');

  if (step1Block && step2Block) {
    step1Block.classList.add('hidden');
    step2Block.classList.remove('hidden');
    clearResumePrompt();

    if (restoreDraft) {
      fillStep2FormFromDraft();
    }

    saveFlowState('step2', email || getRegistrationDraft()?.email || '');

    try {
      step2Block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {}

    applyLang(document);
    applyCustomerLegalLanguage();
    return;
  }

  const step2Form = $('complete-profile-form');
  if (step2Form) {
    clearResumePrompt();

    if (restoreDraft) {
      fillStep2FormFromDraft();
    }

    saveFlowState('step2', email || getRegistrationDraft()?.email || '');

    try {
      step2Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {}

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
    notify('info', copy.backToStep1Info);
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
  const box = getResumePromptBox();
  if (!box) return;

  if (!isStep1Visible() || isStep2Visible()) {
    clearResumePrompt();
    return;
  }

  const draft = getRegistrationDraft();
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
    showStep2UI(draft.email, { restoreDraft: true });
    notify('info', copy.resumedStep2Info);
  });

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'btn soft-hover';
  restartBtn.textContent = copy.resumeRestart;
  restartBtn.addEventListener('click', () => {
    clearRegistrationDraft();
    clearFlowState();
    clearStep2Draft();
    clearResumePrompt();
    resetStep1Form();
    resetStep2Form();
    showStep1UI();
    notify('info', copy.restartClearedInfo);
  });

  actions.appendChild(continueBtn);
  actions.appendChild(restartBtn);

  box.appendChild(title);
  box.appendChild(text);
  box.appendChild(actions);
}

function bindStep2DraftAutosave() {
  const form = $('complete-profile-form');
  if (!form) return;
  if (form.dataset.draftBound === '1') return;
  form.dataset.draftBound = '1';

  const fields = ['firstName', 'lastName', 'personalNumber', 'phone', 'address1', 'postalCode', 'city'];

  fields.forEach((fieldId) => {
    const el = $(fieldId);
    if (!el) return;

    el.addEventListener('input', () => {
      saveStep2Draft(readStep2DraftFromForm());
    });

    el.addEventListener('change', () => {
      saveStep2Draft(readStep2DraftFromForm());
    });
  });
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

    const copy = getCustomerLegalCopy();

    const email = normalizeEmail($('email')?.value || '');
    const emailConfirm = email;

    const password = $('password')?.value || '';
    const passwordConfirm = $('password2')?.value || '';

    const privacyAccepted = $('privacyAccepted')?.checked === true;
    const termsAccepted = $('termsAccepted')?.checked === true;

    if (!email) return notify('error', copy.emailRequired, 'EMAIL_REQUIRED');
    if (email !== emailConfirm) return notify('error', copy.emailMismatch, 'EMAIL_MISMATCH');
    if (!password || password.length < 8) return notify('error', copy.passwordTooShort, 'PASSWORD_TOO_SHORT');
    if (password !== passwordConfirm) return notify('error', copy.passwordMismatch, 'PASSWORD_MISMATCH');
    if (!privacyAccepted) return notify('error', copy.privacyRequired, 'PRIVACY_REQUIRED');
    if (!termsAccepted) return notify('error', copy.termsRequired, 'TERMS_REQUIRED');

    const payload = {
      email,
      emailConfirm,
      password,
      passwordConfirm,
      thirdPartyConsent: true,
      ...buildStep1RegistrationAuditPayload(),
    };

    console.log('DEBUG customer payload (step1):', payload);
    notify('info', copy.creatingAccount);

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step1 response:', res);

      saveRegistrationDraft(email);
      saveFlowState('step2', email);
      setLockedEmailIfPresent(email);

      notify('success', copy.step1Success);
      showStep2UI(email, { restoreDraft: true });
    } catch (err) {
      console.error('Step1 error:', err);

      if (err?.name === 'AbortError') {
        return notify('error', copy.timeout, 'REQUEST_TIMEOUT');
      }

      if (err?.status === 409) {
        saveRegistrationDraft(email);
        saveFlowState('step1', email);
        renderResumePromptIfNeeded();

        return notify(
          'error',
          err.message || copy.emailExists,
          err.errorCode || 'EMAIL_EXISTS'
        );
      }

      return notify(
        'error',
        err.message || copy.registerFailed,
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

    const copy = getCustomerLegalCopy();
    const draft = getRegistrationDraft();
    const email = normalizeEmail(draft?.email || '');

    if (!email) {
      return notify('error', copy.step1Missing, 'STEP1_MISSING');
    }

    setLockedEmailIfPresent(email);
    saveFlowState('step2', email);

    const firstName = (($('firstName')?.value || '')).trim();
    const lastName = (($('lastName')?.value || '')).trim();
    const personalNumber = (($('personalNumber')?.value || '')).trim();
    const phone = (($('phone')?.value || '')).trim();
    const addressStreet = (($('address1')?.value || '')).trim();
    const addressZip = (($('postalCode')?.value || '')).trim();
    const addressCity = (($('city')?.value || '')).trim();

    saveStep2Draft({
      email,
      firstName,
      lastName,
      personalNumber,
      phone,
      addressStreet,
      addressZip,
      addressCity,
    });

    if (!firstName || firstName.length < 2) {
      showStep2UI(email, { restoreDraft: true });
      return notify('error', copy.firstNameInvalid, 'FIRST_NAME_INVALID');
    }

    if (!lastName || lastName.length < 2) {
      showStep2UI(email, { restoreDraft: true });
      return notify('error', copy.lastNameInvalid, 'LAST_NAME_INVALID');
    }

    if (!personalNumber) {
      showStep2UI(email, { restoreDraft: true });
      return notify('error', copy.personalNumberRequired, 'PERSONAL_NUMBER_REQUIRED');
    }

    if (!addressStreet) {
      showStep2UI(email, { restoreDraft: true });
      return notify('error', copy.addressRequired, 'ADDRESS_REQUIRED');
    }

    if (!addressZip) {
      showStep2UI(email, { restoreDraft: true });
      return notify('error', copy.postalCodeRequired, 'POSTAL_CODE_REQUIRED');
    }

    if (!addressCity) {
      showStep2UI(email, { restoreDraft: true });
      return notify('error', copy.cityRequired, 'CITY_REQUIRED');
    }

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
    notify('info', copy.savingProfile);

    try {
      const res = await postJson('/api/customers', payload);
      console.log('DEBUG step2 response:', res);

      notify('success', copy.step2Success);

      clearRegistrationDraft();
      clearResumePrompt();
      clearFlowState();
      clearStep2Draft();

      setTimeout(() => {
        window.location.href = '/profile.html';
      }, 1400);
    } catch (err) {
      console.error('Step2 error:', err);

      showStep2UI(email, { restoreDraft: true });

      if (err?.name === 'AbortError') {
        return notify('error', copy.timeout, 'REQUEST_TIMEOUT');
      }

      if (err?.status === 400) {
        return notify(
          'error',
          err.message || copy.validationFailed,
          err.errorCode || 'VALIDATION_ERROR'
        );
      }

      if (err?.status === 409) {
        return notify(
          'error',
          err.message || copy.conflict,
          err.errorCode || 'CONFLICT'
        );
      }

      return notify(
        'error',
        err.message || copy.saveProfileFailed,
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

function restoreInitialCustomerUIState() {
  const regDraft = getRegistrationDraft();
  const flowState = getFlowState();

  if (regDraft?.email && flowState?.currentStep === 'step2') {
    setLockedEmailIfPresent(regDraft.email);
    showStep2UI(regDraft.email, { restoreDraft: true });
    return;
  }

  showStep1UI();
  renderResumePromptIfNeeded();
}

export function initCustomerPage() {
  if (window.__peerRateCustomerPageInitialized) return;
  window.__peerRateCustomerPageInitialized = true;

  bindLanguageChangeHandler();
  ensureStep2BackButton();
  bindStep2DraftAutosave();

  bindStep1();
  bindStep2();

  applyLang(document);
  applyCustomerLegalLanguage();

  restoreInitialCustomerUIState();
}

export function initCustomerForm() {
  return initCustomerPage();
}

initCustomerPage();

export default initCustomerPage;
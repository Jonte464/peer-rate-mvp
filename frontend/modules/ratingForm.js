// ratingForm.js – Hanterar själva betygsformuläret (lämna omdöme) och login på /lamna-betyg

import { showNotification } from './utils.js';
import auth, { login } from './auth.js';
import api from './api.js';

// ----------------------
// Lämna-betyg: login på separat sida (/lamna-betyg)
// ----------------------
export function initRatingLogin() {
  const form = document.getElementById('rating-login-form');
  const loginCard = document.getElementById('login-card');
  const ratingWrapper = document.getElementById('rating-form-wrapper');
  if (form) form.addEventListener('submit', handleRatingLoginSubmit);

  try {
    const user = auth.getUser();
    if (user) {
      if (loginCard) loginCard.classList.add('hidden');
      if (ratingWrapper) ratingWrapper.classList.remove('hidden');
      try {
        initRatingForm();
      } catch (err) {
        console.error('Could not init rating form', err);
      }
      const raterInput =
        document.querySelector('#rating-form input[name="rater"]') ||
        document.getElementById('rater');
      if (raterInput && user.email) raterInput.value = user.email;
    } else {
      if (loginCard) loginCard.classList.remove('hidden');
      if (ratingWrapper) ratingWrapper.classList.add('hidden');
    }
  } catch (err) {
    console.error('initRatingLogin check user error', err);
  }
}

async function handleRatingLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';
  if (!email || !password) {
    showNotification('error', 'Fyll i både e-post och lösenord.', 'login-status');
    return;
  }
  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      const message = res?.error || 'Inloggningen misslyckades. Kontrollera uppgifterna.';
      showNotification('error', message, 'login-status');
      return;
    }
    showNotification('success', 'Du är nu inloggad.', 'login-status');
    window.setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (err) {
    console.error('handleRatingLoginSubmit error', err);
    showNotification('error', 'Tekniskt fel vid inloggning. Försök igen om en stund.', 'login-status');
  }
}

// ----------------------
// Rating form (skicka betyg)
// ----------------------

export function initRatingForm() {
  const form = document.getElementById('rating-form');
  if (!form) return;
  form.dataset.ratingBound = '1';
  form.addEventListener('submit', handleRatingSubmit);
  const resetBtn = document.getElementById('reset-form');
  if (resetBtn) resetBtn.addEventListener('click', () => form.reset());
}

// Global lyssnare som fångar rating-formulär om det inte bundits direkt
document.addEventListener(
  'submit',
  (e) => {
    try {
      const target = e.target;
      if (!target || !(target instanceof HTMLFormElement)) return;
      if (target.id !== 'rating-form') return;
      if (target.dataset && target.dataset.ratingBound === '1') return;
      e.preventDefault();
      handleRatingSubmit.call(target, e);
    } catch (err) {
      console.error('rating-form delegation error', err);
    }
  },
  true
);

async function handleRatingSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const ratedUserEmail =
    form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment =
    form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef =
    form.querySelector('input[name="proofRef"]')?.value?.trim() || '';

  const sourceRaw = form.querySelector('select[name="source"]')?.value || '';

  if (!ratedUserEmail || !score) {
    showNotification(
      'error',
      'Fyll i alla obligatoriska fält innan du skickar.',
      'notice'
    );
    return;
  }

  try {
    const raterVal =
      form.querySelector('input[name="rater"]')?.value?.trim() || null;

    const reportFlag = !!(
      form.querySelector('#reportFlag')?.checked ||
      form.querySelector('[name="fraudReportEnabled"]')?.checked
    );
    const reportReason =
      form.querySelector('#reportReason')?.value ||
      form.querySelector('[name="fraudType"]')?.value ||
      null;
    const reportDate =
      form.querySelector('#reportDate')?.value ||
      form.querySelector('[name="fraudDate"]')?.value ||
      null;
    const reportTime =
      form.querySelector('#reportTime')?.value ||
      form.querySelector('[name="fraudTime"]')?.value ||
      null;
    const reportAmount =
      form.querySelector('#reportAmount')?.value ||
      form.querySelector('[name="fraudAmount"]')?.value ||
      null;
    const reportLink =
      form.querySelector('#reportLink')?.value ||
      form.querySelector('[name="fraudLink"]')?.value ||
      null;
    const reportText =
      form.querySelector('#reportText')?.value?.trim() ||
      form.querySelector('[name="fraudDescription"]')?.value?.trim() ||
      '';
    const reportConsent = !!(
      form.querySelector('#reportConsent')?.checked ||
      form.querySelector('[name="fraudConsent"]')?.checked
    );

    let composedReportText = reportText || '';
    if (reportDate)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Datum: ${reportDate}`;
    if (reportTime)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Tid: ${reportTime}`;
    if (reportAmount)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Belopp: ${reportAmount}`;
    if (reportLink)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Länk: ${reportLink}`;

    const payload = {
      subject: ratedUserEmail,
      rating: Number(score),
      rater: raterVal || undefined,
      comment: comment || undefined,
      proofRef: proofRef || undefined,
      source: sourceRaw || undefined,
      report: undefined,
    };

    if (reportFlag || reportReason || composedReportText) {
      payload.report = {
        report_flag: !!reportFlag,
        report_reason: reportReason || null,
        report_text: composedReportText || null,
        evidence_url: (form.querySelector('#evidenceUrl')?.value || null) || null,
        report_consent: !!reportConsent,
      };
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    console.log('Sending rating payload:', payload);
    const result = await api.createRating(payload);
    console.log('Rating response:', result);
    if (!result || result.ok === false) {
      const message = result?.error || 'Kunde inte spara betyget.';
      showNotification('error', message, 'notice');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    showNotification('success', 'Tack för ditt omdöme!', 'notice');
    form.reset();
    if (submitBtn) submitBtn.disabled = false;
  } catch (err) {
    console.error('handleRatingSubmit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'notice');
  }
}

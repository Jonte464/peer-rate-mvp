// Handles the Trust Profile feedback questionnaire on `profile.html`
import api from './api.js';

function serializeForm(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    obj[k] = v;
  }
  return obj;
}

function disableForm(form) {
  form.querySelectorAll('input,select,textarea,button').forEach((el) => {
    el.disabled = true;
  });
}

export async function initQuestionnaire() {
  const form = document.getElementById('trust-feedback-form');
  if (!form) return;

  // Attach submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('q-status');
    status.textContent = '';

    // Basic client-side validation
    const reviewer_name = form.querySelector('input[name="reviewer_name"]').value.trim();
    const reviewer_email = form.querySelector('input[name="reviewer_email"]').value.trim();
    if (!reviewer_name || !reviewer_email) {
      status.textContent = 'Please provide your name and work email.';
      return;
    }

    // Build payload including engagement context from DOM
    const engagement = {
      consultant: document.getElementById('q-engagement-consultant')?.textContent || null,
      role: document.getElementById('q-engagement-role')?.textContent || null,
      type: document.getElementById('q-engagement-type')?.textContent || null,
    };

    const payload = {
      engagement,
      responses: serializeForm(form),
      metadata: {
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
    };

    try {
      document.getElementById('q-submit').disabled = true;
      status.textContent = 'Submitting...';

      // Try backend API first
      const res = await fetch('/api/questionnaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        status.textContent = 'Submission failed: ' + (txt || res.statusText);
        document.getElementById('q-submit').disabled = false;
        return;
      }

      status.textContent = 'Thank you — your feedback has been submitted.';
      disableForm(form);
    } catch (err) {
      console.error('Questionnaire submit error', err);
      status.textContent = 'Submission failed — please try again later.';
      document.getElementById('q-submit').disabled = false;
    }
  });
  // Invite send: send questionnaire link to provided email
  const inviteInput = document.getElementById('q-invite-email');
  const inviteBtn = document.getElementById('q-invite-send');
  const inviteStatus = document.getElementById('q-invite-status');

  if (inviteInput && inviteBtn) {
    inviteBtn.addEventListener('click', async () => {
      const to = (inviteInput.value || '').trim();
      inviteStatus.textContent = '';
      if (!to) {
        inviteStatus.textContent = 'Enter a reviewer email address.';
        return;
      }

      inviteBtn.disabled = true;
      inviteStatus.textContent = 'Sending...';

      const engagement = {
        consultant: document.getElementById('q-engagement-consultant')?.textContent || null,
        role: document.getElementById('q-engagement-role')?.textContent || null,
        type: document.getElementById('q-engagement-type')?.textContent || null,
      };

      try {
        const res = await fetch('/api/questionnaires/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, engagement }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          inviteStatus.textContent = 'Failed to send invitation.';
          inviteBtn.disabled = false;
          return;
        }

        if (json && json.queued) inviteStatus.textContent = 'Invitation queued (no SMTP configured).';
        else inviteStatus.textContent = 'Invitation sent.';
        inviteBtn.disabled = false;
      } catch (err) {
        console.error('Invite send error', err);
        inviteStatus.textContent = 'Failed to send invitation.';
        inviteBtn.disabled = false;
      }
    });
  }
}

export default { initQuestionnaire };

// Minimal Invite Form handler
// Purpose: simple, fast consultant-facing form to invite a reviewer.

function qs(id) { return document.getElementById(id); }

function serialize(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  // handle ongoing checkbox
  obj.ongoing = !!qs('inv-ongoing').checked;
  return obj;
}

function validate(obj) {
  const required = ['consultant_name','consultant_title','company_client','client_segment','start_month','reviewer_email'];
  for (const k of required) {
    if (!obj[k] || String(obj[k]).trim() === '') return { ok: false, missing: k };
  }
  // email simple check
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(obj.reviewer_email)) return { ok: false, missing: 'reviewer_email' };
  return { ok: true };
}

function disableForm(disabled) {
  qs('inv-submit').disabled = disabled;
  ['inv-consultant-name','inv-consultant-title','inv-company','inv-segment','inv-start','inv-end','inv-ongoing','inv-reviewer-email'].forEach(id=>{
    const el = qs(id); if (el) el.disabled = disabled;
  });
}

export function initInviteForm() {
  const form = qs('invite-form');
  if (!form) return;

  // Toggle end month when ongoing checked
  const ongoing = qs('inv-ongoing');
  if (ongoing) {
    ongoing.addEventListener('change', () => {
      const end = qs('inv-end');
      if (!end) return;
      if (ongoing.checked) {
        end.disabled = true; end.value = '';
      } else {
        end.disabled = false;
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = qs('inv-status');
    status.textContent = '';

    const data = serialize(form);
    const ok = validate(data);
    if (!ok.ok) {
      status.textContent = 'Please fill the required field: ' + ok.missing;
      return;
    }

    // Store engagement data locally (MVP) — TODO: persist to server-side store
    try {
      localStorage.setItem('peerRate:invite:last', JSON.stringify({ engagement: data, createdAt: new Date().toISOString() }));
    } catch (err) {
      console.warn('Could not save to localStorage', err);
    }

    disableForm(true);
    qs('inv-status').textContent = 'Sending invitation…';

    // Placeholder: send invite via existing send endpoint
    // TODO: consider tokenized single-use links and server-side validation
    try {
      const engagement = {
        consultant: data.consultant_name,
        role: data.consultant_title,
        type: data.company_client + (data.client_segment ? ' | ' + data.client_segment : ''),
        start_month: data.start_month,
        end_month: data.ongoing ? 'Ongoing' : (data.end_month || ''),
      };

      const payload = { to: data.reviewer_email, engagement };

      const res = await fetch('/api/questionnaires/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        qs('inv-status').textContent = 'Failed to send invitation: ' + (txt || res.statusText);
        disableForm(false);
        return;
      }

      const json = await res.json().catch(()=>null);
      if (json && json.queued) qs('inv-status').textContent = 'Invitation queued.';
      else qs('inv-status').textContent = 'Invitation sent.';

      // keep form visible but disabled to avoid repeat sends — for MVP we do not clear
    } catch (err) {
      console.error('Invite send error', err);
      qs('inv-status').textContent = 'Failed to send invitation.';
      disableForm(false);
    }
  });
}

export default { initInviteForm };

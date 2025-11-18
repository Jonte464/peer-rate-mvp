console.log('script.js loaded');

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const el = (id) => document.getElementById(id);

  // Enkel auth-hjälpare (lagras i localStorage på klienten)
  const auth = {
    key: 'peerRateUser',
    getUser() {
      try {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setUser(user) {
      localStorage.setItem(this.key, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(this.key);
    },
  };

  // Enkel lagring för profilbild (endast i webbläsaren)
  const AVATAR_KEY = 'peerRateAvatar';
  function getAvatar() {
    return localStorage.getItem(AVATAR_KEY) || null;
  }
  function setAvatar(dataUrl) {
    if (!dataUrl) return;
    localStorage.setItem(AVATAR_KEY, dataUrl);
  }
  function clearAvatar() {
    localStorage.removeItem(AVATAR_KEY);
  }

  // ---- API helper ----
  const api = {
    createRating: (payload) => {
      return fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (ratings):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    createCustomer: (payload) => {
      return fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (customers):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    login: (payload) => {
      return fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (login):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    searchCustomers: (q) => {
      return fetch(`/api/customers?q=${encodeURIComponent(q)}`, {
        method: 'GET',
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (searchCustomers):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    getRatingsAverage: (subject) => {
      return fetch(`/api/ratings/average?subject=${encodeURIComponent(subject)}`, {
        method: 'GET',
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (ratings/average):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    listRatingsForSubject: (subject) => {
      return fetch(`/api/ratings?subject=${encodeURIComponent(subject)}`, {
        method: 'GET',
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (ratings list):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
  };

  // ---- Notiser för betyg ----
  let noticeTimer = null;
  function showNotice(ok, msg) {
    const box = el('notice');
    if (!box) return;
    box.className = 'notice ' + (ok ? 'ok' : 'err');
    box.textContent = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      box.className = 'notice';
      box.textContent = '';
    }, 6000);
  }
  function clearNotice() {
    const box = el('notice');
    if (!box) return;
    clearTimeout(noticeTimer);
    box.className = 'notice';
    box.textContent = '';
  }

  // ---- Filer för rapport ----
  const filesInput = document.getElementById('reportFiles');
  const fileList = document.getElementById('fileList');
  function readFiles() {
    if (!filesInput || !fileList) return Promise.resolve([]);
    fileList.innerHTML = '';
    const files = Array.from(filesInput.files || []);
    const limited = files.slice(0, 3);
    const over = files.length > 3;
    if (over) showNotice(false, 'Max tre filer – övriga ignoreras.');
    limited.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = `${f.name} (${Math.round(f.size / 1024)} kB)`;
      fileList.appendChild(li);
    });
    return Promise.all(
      limited.map(
        (f) =>
          new Promise((resolve) => {
            if (f.size > 2 * 1024 * 1024) {
              showNotice(false, `${f.name} är större än 2 MB och ignoreras.`);
              return resolve(null);
            }
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: f.name,
                type: f.type,
                size: f.size,
                data: String(reader.result).split(',')[1],
              });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(f);
          })
      )
    ).then((arr) => arr.filter(Boolean));
  }

  function getReportWhenISO(dateStr, timeStr) {
    if (!dateStr && !timeStr) return null;
    const d = dateStr || new Date().toISOString().slice(0, 10);
    const t = timeStr || '00:00';
    const iso = new Date(`${d}T${t}`);
    return isNaN(iso.getTime()) ? null : iso.toISOString();
  }

  // ============================================================
  // LOGIN-BLOCK + badge
  // ============================================================
  const loginEmail = el('login-email');
  const loginPassword = el('login-password');
  const loginBtn = el('login-btn');
  const loginStatus = el('login-status');
  const loginHint = el('login-hint');
  const ratingFormWrapper = el('rating-form-wrapper');
  const profileRoot = el('profile-root');
  const logoutBtn = el('logout-btn');
  const loginCard = el('login-card');

  const userBadge = el('user-badge');
  const userBadgeName = el('user-badge-name');
  const userBadgeAvatar = el('user-badge-avatar');

  const profileAvatarPreview = el('profile-avatar-preview');
  const profileAvatarInput = el('profile-avatar-input');

  function computeInitials(user) {
    if (!user) return 'P';
    const fullName = user.fullName || '';
    const initials =
      fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join('') || (user.email ? user.email[0].toUpperCase() : 'P');
    return initials;
  }

  function updateAvatars(user) {
    const avatarUrl = getAvatar();
    const initials = computeInitials(user);

    // Badge
    if (userBadgeAvatar) {
      if (avatarUrl) {
        userBadgeAvatar.style.backgroundImage = `url(${avatarUrl})`;
        userBadgeAvatar.textContent = '';
      } else {
        userBadgeAvatar.style.backgroundImage = 'none';
        userBadgeAvatar.textContent = initials;
      }
    }

    // Profil-avatar
    if (profileAvatarPreview) {
      if (avatarUrl) {
        profileAvatarPreview.style.backgroundImage = `url(${avatarUrl})`;
        profileAvatarPreview.textContent = '';
      } else {
        profileAvatarPreview.style.backgroundImage = 'none';
        profileAvatarPreview.textContent = initials;
      }
    }
  }

  function updateUserBadge(user) {
    if (!userBadge || !userBadgeName) return;
    if (!user) {
      userBadge.classList.add('hidden');
      return;
    }
    const fullName = user.fullName || '';
    const firstName = fullName.split(' ')[0] || user.email || '';
    userBadgeName.textContent = firstName;
    userBadge.classList.remove('hidden');
    updateAvatars(user);
  }

  // Ritning av “Mitt omdöme”-graf
  async function renderRatingsGraph(subjectEmail) {
    const graphEl = el('ratings-graph');
    if (!graphEl || !subjectEmail) return;

    graphEl.innerHTML = 'Laddar omdömen…';

    try {
      const res = await api.listRatingsForSubject(subjectEmail);
      if (!res || !res.ok || !Array.isArray(res.ratings)) {
        graphEl.textContent = 'Kunde inte hämta omdömen.';
        const listEl = el('ratings-list');
        if (listEl) listEl.innerHTML = '';
        return;
      }

      const list = res.ratings;
      if (list.length === 0) {
        graphEl.textContent = 'Inga omdömen ännu.';
        const listEl = el('ratings-list');
        if (listEl) listEl.innerHTML = '<p class="tiny muted">Du har ännu inga individuella omdömen.</p>';
        return;
      }

      // Gruppera per raterMasked (användare som lämnat omdöme)
      const groups = {};
      for (const r of list) {
        const key = r.raterMasked || 'Anonym';
        if (!groups[key]) {
          groups[key] = { count: 0, sum: 0 };
        }
        groups[key].count += 1;
        groups[key].sum += r.rating;
      }

      const entries = Object.entries(groups).map(([name, data]) => ({
        name,
        count: data.count,
        avg: data.sum / data.count,
      }));

      const maxAvg = entries.reduce((m, e) => Math.max(m, e.avg), 0) || 5;

      graphEl.innerHTML = '';
      entries.forEach((e) => {
        const row = document.createElement('div');
        row.className = 'ratings-graph-row';

        const label = document.createElement('div');
        label.className = 'ratings-graph-label';
        label.textContent = e.name;

        const bar = document.createElement('div');
        bar.className = 'ratings-graph-bar';
        const fill = document.createElement('div');
        fill.className = 'ratings-graph-bar-fill';
        const pct = Math.max(0, Math.min(100, (e.avg / maxAvg) * 100));
        fill.style.width = pct + '%';
        bar.appendChild(fill);

        const val = document.createElement('div');
        val.className = 'ratings-graph-value';
        val.textContent = `${e.avg.toFixed(1)}★ (${e.count})`;

        row.appendChild(label);
        row.appendChild(bar);
        row.appendChild(val);
        graphEl.appendChild(row);
      });

      // Bygg listan med individuella betyg + pratbubbla
      renderRatingsList(list);
    } catch (err) {
      console.error('renderRatingsGraph error:', err);
      graphEl.textContent = 'Kunde inte hämta omdömen.';
      const listEl = el('ratings-list');
      if (listEl) listEl.textContent = 'Kunde inte hämta betyg.';
    }
  }

  function renderRatingsList(ratings) {
    const listEl = el('ratings-list');
    if (!listEl) return;

    if (!ratings || ratings.length === 0) {
      listEl.innerHTML = '<p class="tiny muted">Du har ännu inga individuella omdömen.</p>';
      return;
    }

    listEl.innerHTML = '';
    ratings.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'rating-row';

      const main = document.createElement('div');
      main.className = 'rating-main';

      const stars = document.createElement('div');
      stars.className = 'rating-stars';
      const score = Number(r.rating || 0);
      const fullStars = Math.max(0, Math.min(5, score));
      stars.textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

      const meta = document.createElement('div');
      meta.className = 'rating-meta';
      const d = new Date(r.createdAt);
      const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
      const rater = r.raterMasked || 'Anonym';
      meta.textContent = `${dateStr} · från ${rater}`;

      main.appendChild(stars);
      main.appendChild(meta);
      row.appendChild(main);

      if (r.comment && r.comment.trim().length > 0) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rating-comment-btn';
        btn.innerHTML = '💬';

        const commentBox = document.createElement('div');
        commentBox.className = 'rating-comment-text hidden';
        commentBox.textContent = r.comment;

        btn.addEventListener('click', () => {
          commentBox.classList.toggle('hidden');
        });

        row.appendChild(btn);
        row.appendChild(commentBox);
      }

      listEl.appendChild(row);
    });
  }

  // Fyll “Mina uppgifter” + snittbetyg + graf
  async function refreshProfile() {
    const user = auth.getUser();
    if (!user || !profileRoot) return;

    profileRoot.classList.remove('hidden');

    const nameEl = el('profile-name');
    const emailEl = el('profile-email');
    const pnEl = el('profile-personalNumber');
    const phoneEl = el('profile-phone');
    const streetEl = el('profile-addressStreet');
    const zipEl = el('profile-addressZip');
    const cityEl = el('profile-addressCity');
    const countryEl = el('profile-country');

    const scoreEl = el('profile-score');
    const countEl = el('profile-score-count');
    const barEl = el('profile-score-bar');

    if (nameEl) nameEl.textContent = user.fullName || '–';
    if (emailEl) emailEl.textContent = user.email || '–';

    const email = user.email;
    if (!email) return;

    // Hämta kundinfo (inkl. telefon och adress)
    try {
      const res = await api.searchCustomers(email);
      if (res && res.ok && Array.isArray(res.customers) && res.customers.length > 0) {
        const c = res.customers[0];
        if (pnEl) pnEl.textContent = c.personalNumber || '–';
        if (phoneEl) phoneEl.textContent = c.phone || '–';
        if (streetEl) streetEl.textContent = c.addressStreet || '–';
        if (zipEl) zipEl.textContent = c.addressZip || '–';
        if (cityEl) cityEl.textContent = c.addressCity || '–';
        if (countryEl) countryEl.textContent = c.country || '–';
      }
    } catch (err) {
      console.warn('Kunde inte hämta kundinfo:', err);
    }

    // Hämta snittbetyg
    try {
      const subject = email.trim().toLowerCase();
      const resAvg = await api.getRatingsAverage(subject);
      if (resAvg && resAvg.ok) {
        const avg = Number(resAvg.average || 0);
        const count = Number(resAvg.count || 0);
        if (scoreEl) scoreEl.textContent = count > 0 ? avg.toFixed(2) : '–';
        if (countEl) countEl.textContent = count;
        if (barEl) {
          const pct = count > 0 ? Math.max(0, Math.min(100, (avg / 5) * 100)) : 0;
          barEl.style.width = pct + '%';
        }
      }
    } catch (err) {
      console.warn('Kunde inte hämta snittbetyg:', err);
    }

    await renderRatingsGraph(email);
    updateAvatars(user);
  }

  function updateLoginUI() {
    const user = auth.getUser();
    if (user && loginStatus) {
      loginStatus.textContent = `Inloggad som ${user.email || ''}${user.fullName ? ' (' + user.fullName + ')' : ''}.`;
      if (loginHint) {
        loginHint.innerHTML =
          'Du är inloggad och kan lämna betyg direkt i formuläret nedan.';
      }
      if (ratingFormWrapper) {
        ratingFormWrapper.classList.remove('hidden');
      }
      if (profileRoot) {
        profileRoot.classList.remove('hidden');
        refreshProfile();
      }
      if (loginEmail) loginEmail.value = user.email || '';
      if (loginPassword) loginPassword.value = '';
      const raterInput = el('rater');
      if (raterInput && !raterInput.value && user.email) {
        raterInput.value = user.email;
      }
      if (loginCard) {
        loginCard.classList.add('hidden'); // göm login-kortet helt
      }
      updateUserBadge(user);
    } else {
      if (loginStatus) loginStatus.textContent = 'Inte inloggad.';
      if (loginHint) {
        loginHint.innerHTML =
          'Du behöver logga in för att kunna lämna betyg. ' +
          '<a href="/customer.html" target="_blank" rel="noopener noreferrer">Registrera dig här</a> om du inte redan har ett konto.';
      }
      if (ratingFormWrapper) {
        ratingFormWrapper.classList.add('hidden');
      }
      if (profileRoot) {
        profileRoot.classList.add('hidden');
      }
      if (loginCard) {
        loginCard.classList.remove('hidden');
      }
      updateUserBadge(null);
    }
  }

  // Gemensam login-funktion (knapp + Enter)
  async function handleLogin() {
    const email = loginEmail?.value?.trim() || '';
    const password = loginPassword?.value?.trim() || '';

    if (!email || !password) {
      if (loginStatus) loginStatus.textContent = 'Fyll i både e-post och lösenord.';
      return;
    }

    if (loginStatus) loginStatus.textContent = 'Loggar in...';

    try {
      const res = await api.login({ email, password });
      console.log('Login response:', res);

      if (res && res.ok && res.customer) {
        auth.setUser({
          id: res.customer.id,
          email: res.customer.email,
          fullName: res.customer.fullName,
        });
        if (loginStatus) loginStatus.textContent = 'Inloggning lyckades.';
        updateLoginUI();

        const target = el('profile-root') || el('rate-form');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        const msg = res?.error || 'Inloggningen misslyckades.';
        if (loginStatus) loginStatus.textContent = msg;
      }
    } catch (err) {
      console.error('Login fetch error:', err);
      if (loginStatus) loginStatus.textContent = 'Nätverksfel vid inloggning.';
    }
  }

  if (loginBtn && loginEmail && loginPassword) {
    loginBtn.addEventListener('click', handleLogin);

    const loginKeyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    };
    loginEmail.addEventListener('keydown', loginKeyHandler);
    loginPassword.addEventListener('keydown', loginKeyHandler);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.clear();
      clearAvatar();
      location.reload();
    });
  }

  // Profilbild – lyssna på filuppladdning
  if (profileAvatarInput) {
    profileAvatarInput.addEventListener('change', () => {
      const file = profileAvatarInput.files && profileAvatarInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Välj en bildfil.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        setAvatar(dataUrl);
        const user = auth.getUser();
        updateAvatars(user);
      };
      reader.readAsDataURL(file);
    });
  }

  updateLoginUI();
  if (profileRoot) {
    refreshProfile();
  }

  // ============================================================
  // BETYGFORMULÄR
  // ============================================================
  const form = document.getElementById('rate-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearNotice();

      const user = auth.getUser();
      if (!user) {
        showNotice(false, 'Du måste vara inloggad innan du lämnar betyg.');
        return;
      }

      const subject = el('subject')?.value?.trim() || '';
      let rater = el('rater')?.value?.trim() || '';
      const ratingRaw = el('rating')?.value || '';
      const rating = parseInt(ratingRaw, 10);
      const comment = el('comment')?.value?.trim() || '';
      const proofRef = el('proofRef')?.value?.trim() || '';
      const flag = document.getElementById('reportFlag')?.checked || false;

      if (!subject) return showNotice(false, 'Fyll i vem du betygsätter.');
      if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5)
        return showNotice(false, 'Välj betyg 1–5.');

      if (!rater && user.email) {
        rater = user.email;
      }

      let reportPayload = null;
      if (flag) {
        const reason = el('reportReason')?.value || '';
        const dateS = el('reportDate')?.value || '';
        const timeS = el('reportTime')?.value || '';
        const whenISO = getReportWhenISO(dateS, timeS);
        const amount = el('reportAmount')?.value ? Number(el('reportAmount').value) : null;
        const link = el('reportLink')?.value?.trim() || null;
        const rtext = el('reportText')?.value?.trim() || '';
        const evid = el('evidenceUrl')?.value?.trim() || null;
        const cons = !!document.getElementById('reportConsent')?.checked;

        if (!cons) return showNotice(false, 'Bocka i intygandet under rapportering.');
        if (!reason) return showNotice(false, 'Välj typ av problem.');
        if (!rtext) return showNotice(false, 'Beskriv händelsen kort.');

        const filesPayload = await readFiles();

        reportPayload = {
          report_flag: true,
          report_reason: reason,
          report_when: whenISO,
          report_amount_sek: amount,
          report_link: link,
          report_text: rtext,
          evidence_url: evid,
          report_consent: cons,
          report_files: filesPayload,
        };
      }

      try {
        const body = {
          subject,
          rating,
          comment: comment || null,
          proofRef: proofRef || null,
          ...(reportPayload ? { report: reportPayload } : {}),
        };
        if (rater && rater.length >= 2) body.rater = rater;

        const res = await api.createRating(body);
        console.log('API response (rating):', res);

        if (res && (res.ok || res.id || res.created)) {
          showNotice(true, 'Tack för ditt omdöme – det har skickats.');
          e.target.reset();
          const r = el('rating');
          if (r) r.value = '';
          if (fileList) fileList.innerHTML = '';

          if (profileRoot) {
            refreshProfile();
          }
        } else {
          const msg =
            res?.error || res?.message || `Något gick fel. (status: ${res?.status ?? 'ok?'})`;
          showNotice(false, msg);
        }
      } catch (err) {
        console.error('Fetch error (rating):', err);
        showNotice(false, 'Nätverksfel. Försök igen.');
      }
    });

    const resetBtn = document.getElementById('reset-form');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        form.reset();
        const r = el('rating');
        if (r) r.value = '';
        if (fileList) fileList.innerHTML = '';
        clearNotice();
      });
    }
  }

  // ============================================================ 
  // KUNDREGISTRERING (customer.html)
  // ============================================================
  const customerForm = document.getElementById('customer-form');
  if (customerForm) {
    let custNoticeTimer = null;
    function showCustNotice(ok, msg) {
      const box = el('cust-notice');
      if (!box) return;
      box.className = 'notice ' + (ok ? 'ok' : 'err');
      box.textContent = msg;
      clearTimeout(custNoticeTimer);
      custNoticeTimer = setTimeout(() => {
        box.className = 'notice';
        box.textContent = '';
      }, 7000);
    }
    function clearCustNotice() {
      const box = el('cust-notice');
      if (!box) return;
      clearTimeout(custNoticeTimer);
      box.className = 'notice';
      box.textContent = '';
    }

    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearCustNotice();

      const firstName = el('cust-firstName')?.value?.trim() || '';
      const lastName = el('cust-lastName')?.value?.trim() || '';
      const personalNumber = el('cust-personalNumber')?.value?.trim() || '';
      const email = el('cust-email')?.value?.trim() || '';
      const emailConfirm = el('cust-emailConfirm')?.value?.trim() || '';
      const password = el('cust-password')?.value || '';
      const passwordConfirm = el('cust-passwordConfirm')?.value || '';
      const phone = el('cust-phone')?.value?.trim() || '';
      const addressStreet = el('cust-addressStreet')?.value?.trim() || '';
      const addressZip = el('cust-addressZip')?.value?.trim() || '';
      const addressCity = el('cust-addressCity')?.value?.trim() || '';
      const country = el('cust-country')?.value?.trim() || '';

      // Nya rutor: tredjepartssamtycke + villkor/integritet
      const thirdPartyConsent = el('cust-thirdPartyConsent')?.checked || false;
      const termsAccepted = el('cust-terms')?.checked || false;

      if (!firstName || !lastName) {
        return showCustNotice(false, 'Fyll i både förnamn och efternamn.');
      }
      if (!personalNumber || !/^\d{10,12}$/.test(personalNumber)) {
        return showCustNotice(false, 'Fyll i ett giltigt personnummer med 10–12 siffror.');
      }
      if (!email || !emailConfirm) {
        return showCustNotice(false, 'Fyll i och bekräfta din e-postadress.');
      }
      if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
        return showCustNotice(false, 'E-postadresserna matchar inte.');
      }
      if (!password || password.length < 8) {
        return showCustNotice(false, 'Lösenordet måste vara minst 8 tecken.');
      }
      if (password !== passwordConfirm) {
        return showCustNotice(false, 'Lösenorden matchar inte.');
      }
      if (phone && !/^[0-9+\s\-()]*$/.test(phone)) {
        return showCustNotice(false, 'Telefonnummer får bara innehålla siffror, mellanslag, +, -, ().');
      }

      // Extra säkerhet: kolla att checkboxarna verkligen är ikryssade
      if (!thirdPartyConsent) {
        return showCustNotice(false, 'Du behöver samtycka till inhämtning från tredje part för att kunna använda tjänsten.');
      }
      if (!termsAccepted) {
        return showCustNotice(false, 'Du måste godkänna användarvillkor och integritetspolicy.');
      }

      const body = {
  firstName,
  lastName,
  personalNumber,
  email,
  emailConfirm,
  password,
  passwordConfirm,
  phone: phone || null,
  addressStreet: addressStreet || null,
  addressZip: addressZip || null,
  addressCity: addressCity || null,
  country: country || null,
  thirdPartyConsent,
  termsAccepted,
};


      try {
        const res = await api.createCustomer(body);
        console.log('Customer API response:', res);

        if (res && res.ok) {
          showCustNotice(true, 'Tack! Din registrering har sparats. Du kan nu logga in på sidan Min profil eller Lämna betyg.');
          customerForm.reset();
        } else {
          const msg =
            res?.error ||
            res?.message ||
            (res?.status === 409
              ? 'Det finns redan en användare med samma e-post eller personnummer.'
              : `Något gick fel. (status: ${res?.status ?? 'ok?'})`);
          showCustNotice(false, msg);
        }
      } catch (err) {
        console.error('Customer fetch error:', err);
        showCustNotice(false, 'Nätverksfel. Försök igen.');
      }
    });
  }


  // ============================================================
  // ADMIN-DASHBOARD (admin.html)
  // ============================================================
  const ADMIN_KEY_STORAGE = 'peerRateAdminKey';

  function getAdminKey() {
    return localStorage.getItem(ADMIN_KEY_STORAGE) || null;
  }
  function setAdminKey(key) {
    if (key) localStorage.setItem(ADMIN_KEY_STORAGE, key);
  }
  function clearAdminKey() {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
  }

  // Små helpers för admin-notiser
  function setAdminNotice(id, ok, msg) {
    const box = el(id);
    if (!box) return;
    box.className = 'notice ' + (ok ? 'ok' : 'err');
    box.textContent = msg;
  }

  const adminLoginCard = el('admin-login-card');
  const adminLoginForm = el('admin-login-form');
  const adminPasswordInput = el('admin-password');
  const adminLoginNotice = el('admin-login-notice');
  const adminRoot = el('admin-root');
  const adminLogoutBtn = el('admin-logout-btn');

  const adminStatCustomers = el('stat-customers');
  const adminStatRatings = el('stat-ratings');
  const adminStatReports = el('stat-reports');
  const adminRatingsTable = el('admin-ratings-table');
  const adminReportsTable = el('admin-reports-table');
  const adminSearchForm = el('admin-search-form');
  const adminSearchInput = el('admin-search-input');
  const adminSearchResult = el('admin-search-result');

  // Använd samma fetch, men lägg till x-admin-key-header om admin är inloggad
  async function adminFetch(path, options = {}) {
    const key = getAdminKey();
    if (!key) {
      throw new Error('No admin key set');
    }
    const opts = {
      ...options,
      headers: {
        ...(options.headers || {}),
        'Content-Type':
          options.headers && options.headers['Content-Type']
            ? options.headers['Content-Type']
            : 'application/json',
        'x-admin-key': key,
      },
    };
    const res = await fetch(path, opts);
    const raw = await res.text();
    try {
      const json = JSON.parse(raw);
      return json;
    } catch {
      console.warn('Non-JSON response (adminFetch):', raw);
      return { ok: res.ok, status: res.status, raw };
    }
  }

  async function loadAdminSummary() {
    if (!adminRoot) return;
    try {
      const res = await adminFetch('/api/admin/summary');
      if (res && res.ok && res.counts) {
        if (adminStatCustomers) adminStatCustomers.textContent = String(res.counts.customers);
        if (adminStatRatings) adminStatRatings.textContent = String(res.counts.ratings);
        if (adminStatReports) adminStatReports.textContent = String(res.counts.reports);
      } else {
        if (adminStatCustomers) adminStatCustomers.textContent = '?';
        if (adminStatRatings) adminStatRatings.textContent = '?';
        if (adminStatReports) adminStatReports.textContent = '?';
      }
    } catch (err) {
      console.error('loadAdminSummary error:', err);
      if (adminStatCustomers) adminStatCustomers.textContent = '?';
      if (adminStatRatings) adminStatRatings.textContent = '?';
      if (adminStatReports) adminStatReports.textContent = '?';
    }
  }

  async function loadAdminRecentRatings() {
    if (!adminRatingsTable) return;
    adminRatingsTable.textContent = 'Laddar…';
    try {
      const res = await adminFetch('/api/admin/ratings/recent?limit=20');
      if (!res || !res.ok || !Array.isArray(res.ratings) || res.ratings.length === 0) {
        adminRatingsTable.textContent = 'Inga betyg hittades.';
        return;
      }
      const rows = res.ratings;
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML =
        '<tr><th>Datum</th><th>Subject</th><th>Betyg</th><th>Rater</th><th>Kommentar</th></tr>';
      const tbody = document.createElement('tbody');
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const d = new Date(r.createdAt);
        const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
        tr.innerHTML = `
          <td>${dateStr}</td>
          <td>${r.subject || ''}</td>
          <td>${r.rating ?? ''}</td>
          <td>${r.raterMasked || ''}</td>
          <td>${(r.comment || '').slice(0, 120)}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      adminRatingsTable.innerHTML = '';
      adminRatingsTable.appendChild(table);
    } catch (err) {
      console.error('loadAdminRecentRatings error:', err);
      adminRatingsTable.textContent = 'Kunde inte ladda betyg.';
    }
  }

  async function loadAdminRecentReports() {
    if (!adminReportsTable) return;
    adminReportsTable.textContent = 'Laddar…';
    try {
      const res = await adminFetch('/api/admin/reports/recent?limit=20');
      if (!res || !res.ok || !Array.isArray(res.reports) || res.reports.length === 0) {
        adminReportsTable.textContent = 'Inga rapporter hittades.';
        return;
      }
      const rows = res.reports;
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML =
        '<tr><th>Datum</th><th>Kund</th><th>Reason</th><th>Status</th><th>Belopp</th></tr>';
      const tbody = document.createElement('tbody');
      rows.forEach((r) => {
        const d = new Date(r.createdAt);
        const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
        const name = r.fullName || r.subjectRef || '';
        const amount = r.amount ? `${r.amount} ${r.currency || 'SEK'}` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${dateStr}</td>
          <td>${name}</td>
          <td>${r.reason}</td>
          <td>${r.status}</td>
          <td>${amount}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      adminReportsTable.innerHTML = '';
      adminReportsTable.appendChild(table);
    } catch (err) {
      console.error('loadAdminRecentReports error:', err);
      adminReportsTable.textContent = 'Kunde inte ladda rapporter.';
    }
  }

  async function handleAdminSearch(q) {
    if (!adminSearchResult) return;
    adminSearchResult.textContent = 'Söker…';
    try {
      const res = await adminFetch(`/api/admin/customer?q=${encodeURIComponent(q)}`);
      if (!res || !res.ok || !res.customer) {
        adminSearchResult.textContent = 'Ingen kund hittades för sökningen.';
        return;
      }
      const c = res.customer;
      let html = '';
      html += `<div><strong>${c.fullName || '(namn saknas)'}</strong></div>`;
      html += `<div class="tiny muted">E-post: ${c.email || '–'} | subjectRef: ${
        c.subjectRef || '–'
      } | personnummer: ${c.personalNumber || '–'}</div>`;
      html += `<div class="tiny" style="margin-top:6px;">Snittbetyg: <strong>${(
        c.average ?? 0
      ).toFixed(2)}</strong> / 5 (${c.count} omdömen)</div>`;

      if (Array.isArray(c.ratings) && c.ratings.length) {
        html +=
          '<table><thead><tr><th>Datum</th><th>Betyg</th><th>Rater</th><th>Kommentar</th></tr></thead><tbody>';
        c.ratings.forEach((r) => {
          const d = new Date(r.createdAt);
          const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
          html += `<tr>
            <td>${dateStr}</td>
            <td>${r.score}</td>
            <td>${r.raterName || ''}</td>
            <td>${(r.text || '').slice(0, 160)}</td>
          </tr>`;
        });
        html += '</tbody></table>';
      } else {
        html += '<div class="tiny muted" style="margin-top:6px;">Inga omdömen ännu.</div>';
      }

      adminSearchResult.innerHTML = html;
    } catch (err) {
      console.error('handleAdminSearch error:', err);
      adminSearchResult.textContent = 'Fel vid sökning.';
    }
  }

  function updateAdminUIAfterLogin() {
    if (!adminRoot || !adminLoginCard) return;
    const key = getAdminKey();
    if (key) {
      adminRoot.classList.remove('hidden');
      adminLoginCard.classList.add('hidden');
      loadAdminSummary();
      loadAdminRecentRatings();
      loadAdminRecentReports();
    } else {
      adminRoot.classList.add('hidden');
      adminLoginCard.classList.remove('hidden');
    }
  }

  if (adminLoginForm && adminPasswordInput) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!adminLoginNotice) return;
      const pwd = adminPasswordInput.value.trim();
      if (!pwd) {
        setAdminNotice('admin-login-notice', false, 'Fyll i admin-lösenord.');
        return;
      }
      setAdminNotice('admin-login-notice', true, 'Loggar in…');
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd }),
        }).then(async (r) => {
          const raw = await r.text();
          try {
            return JSON.parse(raw);
          } catch {
            console.warn('Non-JSON response (admin login):', raw);
            return { ok: r.ok, status: r.status, raw };
          }
        });

        if (res && res.ok) {
          setAdminNotice('admin-login-notice', true, 'Admin-inloggning lyckades.');
          setAdminKey(pwd);
          updateAdminUIAfterLogin();
        } else {
          const msg = res?.error || 'Admin-inloggning misslyckades.';
          setAdminNotice('admin-login-notice', false, msg);
        }
      } catch (err) {
        console.error('Admin login error:', err);
        setAdminNotice('admin-login-notice', false, 'Nätverksfel vid admin-inloggning.');
      }
    });
  }

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => {
      clearAdminKey();
      updateAdminUIAfterLogin();
    });
  }

  if (adminSearchForm && adminSearchInput) {
    adminSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = adminSearchInput.value.trim();
      if (!q) {
        if (adminSearchResult) adminSearchResult.textContent = 'Fyll i något att söka på.';
        return;
      }
      handleAdminSearch(q);
    });
  }

  // När sidan laddas: kolla om admin-nyckel redan finns
  if (adminRoot || adminLoginCard) {
    updateAdminUIAfterLogin();
  }
});

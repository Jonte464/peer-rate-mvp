// Fetch and clone the Trust Card markup from /profile.html and insert on landing
export async function initProfileExample() {
  try {
    const res = await fetch('/profile.html');
    if (!res.ok) return;
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const card = doc.querySelector('.trust-profile-card');
    if (!card) return;
    const clone = card.cloneNode(true);
    // Replace IDs inside clone to avoid accidental collisions and allow multiple inserts
    clone.querySelectorAll('[id]').forEach(el => {
      el.id = 'landing-' + el.id;
    });

    // Scoped frosted/translucent profile styles (reuse profile look without changing component)
    const styleId = 'landing-profile-frost-style';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        /* Reuse profile frosted/translucent styles scoped to landing wrapper */
        #landing-profile-root { display:block; }
        #landing-profile-root .trust-profile-card,
        #landing-profile-root .trust-profile-card .card,
        #landing-profile-root .trust-profile-card section,
        #landing-profile-root aside.card {
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.09) !important;
          color: #ffffff !important;
          -webkit-backdrop-filter: blur(8px) saturate(120%);
          backdrop-filter: blur(8px) saturate(120%);
          box-shadow: 0 6px 20px rgba(2,6,23,0.35) !important;
        }
        /* Ensure any textual elements inside the landing wrapper are readable (force white) */
        #landing-profile-root * { color: #ffffff !important; }
        #landing-profile-root .trust-profile-card span[style*="background:"] { color: inherit !important; }
        /* Keep the demo badges and share button light-blue and semi-transparent */
        #landing-profile-root #landing-badge-verified,
        #landing-profile-root #landing-badge-confidence,
        #landing-profile-root #landing-badge-strong {
          background: rgba(59,130,246,0.08) !important;
          color: #0369a1 !important;
          padding: 6px 10px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 12px !important;
        }
        #landing-profile-root #landing-profile-share-btn {
          background: rgba(59,130,246,0.08) !important;
          color: #0369a1 !important;
          border: 1px solid rgba(59,130,246,0.18) !important;
        }
        /* Override inline white sub-cards inside the cloned card to be translucent */
        #landing-profile-root .trust-profile-card div[style*="background:#f8fafc"],
        #landing-profile-root .trust-profile-card div[style*="background:#fbfbff"],
        #landing-profile-root .trust-profile-card div[style*="background:#f1f5f9"],
        #landing-profile-root .trust-profile-card div[style*="background:#ffffff"],
        #landing-profile-root .trust-profile-card section[style*="background:#fbfbff"] {
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: #fff !important;
          box-shadow: none !important;
        }
      `;
      document.head.appendChild(s);
    }

    // Set dummy demo data (only text/content changes)
    const setText = (idSuffix, txt) => {
      const el = clone.querySelector('#landing-' + idSuffix);
      if (el) el.textContent = txt;
    };
    setText('profile-fullname', 'Alex Morgan');
    setText('profile-title', 'Senior Product Designer, 8+ years');
    setText('profile-location', 'Stockholm, Sweden');
    setText('profile-score-big', '95');
    setText('feedback-client', 'Excellent');
    setText('feedback-leadership', 'Strong');
    setText('feedback-consistency', 'Recent & Stable');
    setText('verification-level', 'High');

    // Replace engagement content if present
    const engagementTitle = clone.querySelector('#landing-engagement-title');
    if (engagementTitle) engagementTitle.textContent = 'Acme Corp';
    const engagementRole = clone.querySelector('#landing-engagement-role');
    if (engagementRole) engagementRole.textContent = 'Product Designer';

    // Insert into card slot inside placeholder (do not alter TrustCard structure)
    const slot = document.getElementById('landing-profile-card-slot');
    if (slot) slot.appendChild(clone);
  } catch (err) {
    console.debug('profileExample init error', err);
  }
}

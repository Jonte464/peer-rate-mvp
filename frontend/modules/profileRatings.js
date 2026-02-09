// profileRatings.js – Hanterar visning av "Mitt omdöme" på profilsidan

import api from './api.js';

// Hjälpare: översätt RatingSource -> svensk etikett
function mapRatingSourceLabel(source) {
  if (!source) return 'Annat/okänt';
  const s = String(source).toUpperCase();
  switch (s) {
    // Removed BLOCKET/TRADERA labels
    case 'AIRBNB':
      return 'Airbnb';
    case 'HUSKNUTEN':
      return 'Husknuten';
    case 'TIPTAP':
      return 'Tiptap';
    case 'OTHER':
    default:
      return 'Annat/okänt';
  }
}

// 5 st P-symboler, med stöd för halvor
export function renderPRating(avg) {
  const row = document.getElementById('rating-p-symbols');
  const text = document.getElementById('rating-p-symbols-text');
  if (!row) return;

  row.innerHTML = '';
  const valRaw = Number(avg);
  const val = Math.max(0, Math.min(5, isNaN(valRaw) ? 0 : valRaw));

  for (let i = 1; i <= 5; i++) {
    let cls = 'rating-p';
    if (val >= i) {
      cls += ' full';
    } else if (val >= i - 0.5) {
      cls += ' half';
    }
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = 'P';
    row.appendChild(span);
  }

  if (text) {
    if (!avg || isNaN(valRaw)) {
      text.textContent = 'Inga omdömen ännu.';
    } else {
      text.textContent = `Din nuvarande rating är ${val.toFixed(1)} / 5.`;
    }
  }
}

// Tårtliknande illustration för varifrån omdömena kommer
export function renderRatingSources(ratings) {
  const pie = document.getElementById('rating-source-pie');
  const pieLabel = document.getElementById('rating-source-pie-label');
  const legend = document.getElementById('rating-source-legend');
  if (!pie || !legend) return;

  if (!Array.isArray(ratings) || ratings.length === 0) {
    pie.style.background = '#f1e4d5';
    if (pieLabel) pieLabel.textContent = 'Inga omdömen';
    legend.innerHTML = '<div class="tiny muted">Inga omdömen ännu.</div>';
    return;
  }

  const counts = new Map();
  for (const r of ratings) {
    const label = mapRatingSourceLabel(
      r.source || r.ratingSource || r.sourceLabel
    );
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = ratings.length;

  const colors = ['#f6a94b', '#1b1533', '#4a425e', '#0b7a65', '#c67e3d', '#8b6bff'];
  let current = 0;
  const parts = [];

  legend.innerHTML = '';
  entries.forEach(([name, count], idx) => {
    const share = (count / total) * 100;
    const start = current;
    const end = start + share;
    current = end;
    const color = colors[idx % colors.length];
    parts.push(`${color} ${start}% ${end}%`);

    const item = document.createElement('div');
    item.className = 'rating-legend-item';
    item.innerHTML = `
      <span class="rating-legend-color" style="background:${color}"></span>
      <span class="rating-legend-label">${name}</span>
      <span class="rating-legend-value">${Math.round(share)}% (${count})</span>
    `;
    legend.appendChild(item);
  });

  pie.style.background = `conic-gradient(${parts.join(', ')})`;
  if (pieLabel) pieLabel.textContent = `${total} omdömen`;
}

// Hämta och rendera "Mitt omdöme"
export async function loadMyRating() {
  try {
    const info = await api.getMyRating();
    if (!info) {
      renderPRating(null);
      renderRatingSources([]);
      return;
    }

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent =
        value === undefined || value === null || value === '' ? '-' : String(value);
    };

    if (typeof info.average === 'number') {
      set('profile-score', String(info.average));
      set('profile-score-count', String(info.count || 0));
      const fill = document.getElementById('profile-score-bar');
      if (fill) {
        const pct = Math.max(
          0,
          Math.min(100, (info.average / 5) * 100)
        );
        fill.style.width = `${pct}%`;
      }
    }

    // Övergripande illustrationer
    renderPRating(info.average);
    renderRatingSources(info.ratings || []);

    // Lista med individuella omdömen
    const listEl = document.getElementById('ratings-list');
    if (listEl) {
      if (!Array.isArray(info.ratings) || info.ratings.length === 0) {
        listEl.innerHTML =
          '<div class="tiny muted">Inga omdömen än.</div>';
      } else {
        let html = '';
        info.ratings.forEach((r) => {
          const d = new Date(r.createdAt);
          const dateStr = isNaN(d.getTime())
            ? ''
            : d.toLocaleString('sv-SE');

          const score = r.rating || r.score || '';

          // 👇 Försök först med riktiga fält från databasen
          const rawRaterName =
            (r.raterName || r.raterEmail || r.rater || '').toString().trim();

          // Om backend skickar med någon "etikett", t.ex. "Tip-tap användare"
          const channelLabel = (r.raterLabel || '').toString().trim();

          // Riktig visning: "Anna J" om vi har det, annars ev. "Tip-tap användare", annars "Okänd"
          const raterDisplay = rawRaterName || channelLabel || 'Okänd';

          const sourceLabel = mapRatingSourceLabel(
            r.source || r.ratingSource || r.sourceLabel
          );

          const metaParts = [];
          if (raterDisplay && raterDisplay !== 'Okänd') {
            metaParts.push(`av ${raterDisplay}`);
          }
          if (sourceLabel) {
            metaParts.push(`betyg via ${sourceLabel}`);
          }
          if (dateStr) {
            metaParts.push(dateStr);
          }
          const metaText = metaParts.join(' · ');

          html += `<div class="rating-row">
            <div class="rating-main">
              <div class="rating-stars">${score} / 5</div>
              <div class="rating-meta">${metaText}</div>
              <div class="rating-comment-inline">${(r.comment || r.text || '').slice(0,400)}</div>
            </div>
          </div>`;
        });
        listEl.innerHTML = html;
      }
    }
  } catch (err) {
    console.error('Kunde inte ladda Mitt omdöme', err);
    renderPRating(null);
    renderRatingSources([]);
  }
}

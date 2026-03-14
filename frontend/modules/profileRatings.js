// profileRatings.js – Hanterar visning av "Mitt omdöme" på profilsidan

import api from './api.js';
import { t, getCurrentLanguage, applyLang } from './landing/language.js';

let latestRatingPayload = null;

function mapRatingSourceLabel(source) {
  if (!source) return t('profile_rating_source_other', 'Other/unknown');

  const s = String(source).toUpperCase();

  switch (s) {
    case 'BLOCKET':
      return 'Blocket';
    case 'TRADERA':
      return 'Tradera';
    case 'AIRBNB':
      return 'Airbnb';
    case 'HUSKNUTEN':
      return 'Husknuten';
    case 'TIPTAP':
      return 'Tiptap';
    case 'HYGGLO':
      return 'Hygglo';
    case 'FACEBOOK':
      return 'Facebook Marketplace';
    case 'EBAY':
      return 'eBay';
    case 'OTHER':
    default:
      return t('profile_rating_source_other', 'Other/unknown');
  }
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';

  const locale = getCurrentLanguage() === 'sv' ? 'sv-SE' : 'en-GB';
  return d.toLocaleString(locale);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setDynamicPieCenterLabel(text) {
  const pieLabel = document.getElementById('rating-source-pie-label');
  if (!pieLabel) return;

  // Viktigt:
  // Detta element renderas dynamiskt och får inte skrivas över av applyLang(document).
  pieLabel.removeAttribute('data-i18n');
  pieLabel.textContent = text;
}

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
      text.textContent = t('profile_no_ratings_yet', 'No ratings yet.');
    } else {
      text.textContent = t('profile_current_rating', 'Your current rating is {value} / 5.', {
        value: val.toFixed(1),
      });
    }
  }
}

export function renderRatingSources(ratings) {
  const pie = document.getElementById('rating-source-pie');
  const legend = document.getElementById('rating-source-legend');
  if (!pie || !legend) return;

  if (!Array.isArray(ratings) || ratings.length === 0) {
    pie.style.background = '#f1e4d5';
    setDynamicPieCenterLabel(t('profile_no_ratings', 'No ratings'));
    legend.innerHTML = `<div class="tiny muted">${escapeHtml(t('profile_no_ratings_yet', 'No ratings yet.'))}</div>`;
    return;
  }

  const counts = new Map();
  for (const r of ratings) {
    const label = mapRatingSourceLabel(r.source || r.ratingSource || r.sourceLabel);
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
      <span class="rating-legend-label">${escapeHtml(name)}</span>
      <span class="rating-legend-value">${Math.round(share)}% (${count})</span>
    `;
    legend.appendChild(item);
  });

  pie.style.background = `conic-gradient(${parts.join(', ')})`;
  setDynamicPieCenterLabel(
    t('profile_total_ratings', '{count} ratings', { count: total })
  );
}

function renderRatingsList(ratings) {
  const listEl = document.getElementById('ratings-list');
  if (!listEl) return;

  if (!Array.isArray(ratings) || ratings.length === 0) {
    listEl.innerHTML = `<div class="tiny muted">${escapeHtml(t('profile_no_ratings_short', 'No ratings yet.'))}</div>`;
    return;
  }

  let html = '';

  ratings.forEach((r) => {
    const dateStr = formatDate(r.createdAt);
    const score = r.rating || r.score || '';

    const rawRaterName =
      (r.raterName || r.raterEmail || r.rater || '').toString().trim();

    const channelLabel = (r.raterLabel || '').toString().trim();
    const unknownText = t('profile_rater_unknown', 'Unknown');
    const raterDisplay = rawRaterName || channelLabel || unknownText;

    const sourceLabel = mapRatingSourceLabel(
      r.source || r.ratingSource || r.sourceLabel
    );

    const metaParts = [];

    if (raterDisplay && raterDisplay !== unknownText) {
      metaParts.push(t('profile_rating_by', 'by {name}', { name: raterDisplay }));
    }

    if (sourceLabel) {
      metaParts.push(t('profile_rating_via', 'rated via {source}', { source: sourceLabel }));
    }

    if (dateStr) {
      metaParts.push(dateStr);
    }

    const metaText = metaParts.join(' · ');
    const comment = (r.comment || r.text || '').slice(0, 400);

    html += `<div class="rating-row">
      <div class="rating-main">
        <div class="rating-stars">${escapeHtml(String(score))} / 5</div>
        <div class="rating-meta">${escapeHtml(metaText)}</div>
        <div class="rating-comment-inline">${escapeHtml(comment)}</div>
      </div>
    </div>`;
  });

  listEl.innerHTML = html;
}

export function rerenderRatingWidgetsFromCache() {
  if (!latestRatingPayload) return;

  renderPRating(latestRatingPayload.average);
  renderRatingSources(latestRatingPayload.ratings || []);
  renderRatingsList(latestRatingPayload.ratings || []);
  applyLang(document);
}

export async function loadMyRating() {
  try {
    const info = await api.getMyRating();

    latestRatingPayload = info || {
      average: null,
      count: 0,
      ratings: [],
    };

    if (!info) {
      renderPRating(null);
      renderRatingSources([]);
      renderRatingsList([]);
      return;
    }

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value === undefined || value === null || value === '' ? '-' : String(value);
    };

    if (typeof info.average === 'number') {
      set('profile-score', String(info.average));
      set('profile-score-count', String(info.count || 0));

      const fill = document.getElementById('profile-score-bar');
      if (fill) {
        const pct = Math.max(0, Math.min(100, (info.average / 5) * 100));
        fill.style.width = `${pct}%`;
      }
    } else {
      set('profile-score', '-');
      set('profile-score-count', String(info.count || 0));
    }

    renderPRating(info.average);
    renderRatingSources(info.ratings || []);
    renderRatingsList(info.ratings || []);

    applyLang(document);
  } catch (err) {
    console.error('Kunde inte ladda Mitt omdöme', err);
    latestRatingPayload = {
      average: null,
      count: 0,
      ratings: [],
    };
    renderPRating(null);
    renderRatingSources([]);
    renderRatingsList([]);
  }
}
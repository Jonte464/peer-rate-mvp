// profile.js - Hanterar profilvisning och uppdatering

import { el } from './utils.js';

function updateUserBadge(user) {
  const userBadge = el('user-badge');
  const userBadgeName = el('user-badge-name');
  if (!userBadge || !userBadgeName) return;
  if (!user) {
    userBadge.classList.add('hidden');
    return;
  }
  const fullName = user.fullName || '';
  const firstName = fullName.split(' ')[0] || user.email || '';
  userBadgeName.textContent = firstName;
  userBadge.classList.remove('hidden');
}

function updateAvatars(user) {
  const avatarUrl = localStorage.getItem('peerRateAvatar');
  const initials = user.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase()
    : 'P';

  const userBadgeAvatar = el('user-badge-avatar');
  const profileAvatarPreview = el('profile-avatar-preview');

  if (userBadgeAvatar) {
    userBadgeAvatar.style.backgroundImage = avatarUrl ? `url(${avatarUrl})` : 'none';
    userBadgeAvatar.textContent = avatarUrl ? '' : initials;
  }

  if (profileAvatarPreview) {
    profileAvatarPreview.style.backgroundImage = avatarUrl ? `url(${avatarUrl})` : 'none';
    profileAvatarPreview.textContent = avatarUrl ? '' : initials;
  }
}

export { updateUserBadge, updateAvatars };
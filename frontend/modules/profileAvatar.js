// frontend/modules/profileAvatar.js
// Kompatibilitets-shim.
// Den riktiga avatar-logiken ligger nu i profile.js för att undvika dubbelbindning,
// olika localStorage-nycklar och att bilden försvinner mellan sidbyten.

export function initProfileAvatarShim() {
  // medvetet tom
}

if (typeof window !== 'undefined') {
  window.__peerRateProfileAvatarShimLoaded = true;
}
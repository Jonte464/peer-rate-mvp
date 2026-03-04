// frontend/modules/profileAvatar.js
// Lokal profilbild (localStorage) + sync mellan preview och user-badge.
// Öppnar file picker via en riktig knapp för maximal kompatibilitet.

const STORAGE_KEY = "peerrate_profile_avatar_dataurl_v2";

const $ = (id) => document.getElementById(id);

function setElAvatar(el, dataUrl) {
  if (!el) return;

  el.innerHTML = "";
  if (!dataUrl) {
    el.textContent = "PR";
    return;
  }

  const img = document.createElement("img");
  img.alt = "Profilbild";
  img.src = dataUrl;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.display = "block";
  el.appendChild(img);
}

function loadAvatar() {
  try { return localStorage.getItem(STORAGE_KEY) || ""; }
  catch { return ""; }
}

function saveAvatar(dataUrl) {
  try { localStorage.setItem(STORAGE_KEY, dataUrl); }
  catch { /* ignore */ }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function isImage(file) {
  return !!file && typeof file.type === "string" && file.type.startsWith("image/");
}

function init() {
  const input = $("profile-avatar-input");
  const btn = $("profile-avatar-btn");
  const status = $("profile-avatar-status");
  const preview = $("profile-avatar-preview");
  const badge = $("user-badge-avatar");

  if (!input || !preview) {
    console.warn("[profileAvatar] Missing DOM elements");
    return;
  }

  // Gör input osynlig men klickbar via JS
  input.style.position = "absolute";
  input.style.left = "-9999px";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0";

  // Ladda sparad avatar
  const existing = loadAvatar();
  if (existing) {
    setElAvatar(preview, existing);
    setElAvatar(badge, existing);
  }

  const openPicker = () => {
    try {
      input.click();
      if (status) status.textContent = "";
    } catch (e) {
      console.error(e);
      if (status) status.textContent = "Kunde inte öppna filväljaren i denna browser.";
    }
  };

  if (btn) btn.addEventListener("click", openPicker);
  preview.addEventListener("click", openPicker);
  if (badge) badge.addEventListener("click", openPicker);

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    if (!isImage(file)) {
      if (status) status.textContent = "Välj en bildfil (jpg/png).";
      input.value = "";
      return;
    }

    const maxBytes = 3 * 1024 * 1024; // 3 MB
    if (file.size > maxBytes) {
      if (status) status.textContent = "Bilden är för stor. Välj en under ca 3 MB.";
      input.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      saveAvatar(dataUrl);
      setElAvatar(preview, dataUrl);
      setElAvatar(badge, dataUrl);
      if (status) status.textContent = "Profilbild uppdaterad (sparas lokalt i webbläsaren).";
    } catch (e) {
      console.error(e);
      if (status) status.textContent = "Kunde inte läsa bilden. Testa en annan fil.";
    } finally {
      input.value = "";
    }
  });

  console.log("[profileAvatar] initialized");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
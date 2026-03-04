// modules/profileAvatar.js
// Robust lokal profilbild: preview + localStorage + sync mot user-badge
// Påverkar inte backend, ingen Chrome review behövs.

const STORAGE_KEY = "peerrate_profile_avatar_dataurl_v1";

function $(id) {
  return document.getElementById(id);
}

function setAvatarInEl(el, dataUrl) {
  if (!el) return;

  // Rensa och rendera som bild (för att slippa CSS-strul)
  el.innerHTML = "";

  if (!dataUrl) {
    el.textContent = "PR";
    return;
  }

  const img = document.createElement("img");
  img.alt = "Profilbild";
  img.src = dataUrl;
  el.appendChild(img);
}

function loadAvatar() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveAvatar(dataUrl) {
  try {
    localStorage.setItem(STORAGE_KEY, dataUrl);
  } catch {
    // ignore
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function isImageFile(file) {
  return !!file && typeof file.type === "string" && file.type.startsWith("image/");
}

function init() {
  const input = $("profile-avatar-input");
  const preview = $("profile-avatar-preview");
  const badge = $("user-badge-avatar");

  if (!input || !preview) return;

  // 1) Ladda ev sparad avatar vid start
  const existing = loadAvatar();
  if (existing) {
    setAvatarInEl(preview, existing);
    setAvatarInEl(badge, existing);
  }

  // 2) Klick på preview/badge ska öppna fil-dialogen
  const openPicker = () => {
    // Om input är hidden via css/position, funkar detta ändå.
    input.click();
  };

  preview.addEventListener("click", openPicker);
  if (badge) badge.addEventListener("click", openPicker);

  // 3) När användaren väljer fil
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    if (!isImageFile(file)) {
      alert("Välj en bildfil (t.ex. .jpg eller .png).");
      input.value = "";
      return;
    }

    // Enkel storleksguard (kan justeras)
    const maxBytes = 2.5 * 1024 * 1024; // 2.5 MB
    if (file.size > maxBytes) {
      alert("Bilden är för stor. Välj en bild under ca 2.5 MB.");
      input.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      saveAvatar(dataUrl);
      setAvatarInEl(preview, dataUrl);
      setAvatarInEl(badge, dataUrl);
    } catch (e) {
      console.error("Avatar upload failed", e);
      alert("Kunde inte läsa bilden. Testa en annan fil.");
    } finally {
      // Om man vill kunna välja samma fil igen
      input.value = "";
    }
  });
}

// Kör när DOM finns
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
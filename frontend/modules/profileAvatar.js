// frontend/modules/profileAvatar.js
// Sparar avatar lokalt (localStorage) och sätter den i preview + user-badge/top-row om de finns.

const STORAGE_KEY = "peerrate.avatar.dataUrl";

function setBgImage(el, dataUrl) {
  if (!el) return;
  el.style.backgroundImage = `url("${dataUrl}")`;
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";
  el.textContent = ""; // ta bort PR/initialer om bild finns
}

function setStatus(msg) {
  const s = document.getElementById("profile-avatar-status");
  if (s) s.textContent = msg || "";
}

function loadExisting() {
  const dataUrl = localStorage.getItem(STORAGE_KEY);
  if (!dataUrl) return;

  setBgImage(document.getElementById("profile-avatar-preview"), dataUrl);
  setBgImage(document.getElementById("user-badge-avatar"), dataUrl);

  // top-row pill (om main.js använder initialer)
  const topPill = document.getElementById("topUserPill");
  if (topPill) setBgImage(topPill, dataUrl);

  setStatus("Profilbild sparad lokalt.");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kunde inte läsa filen"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function onFileChange(e) {
  try {
    const input = e.target;
    const file = input?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Välj en bildfil (png/jpg/webp).");
      input.value = "";
      return;
    }

    // 2 MB guard (kan justeras)
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setStatus("Bilden är för stor. Välj en bild under 2 MB.");
      input.value = "";
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    localStorage.setItem(STORAGE_KEY, dataUrl);

    setBgImage(document.getElementById("profile-avatar-preview"), dataUrl);
    setBgImage(document.getElementById("user-badge-avatar"), dataUrl);

    const topPill = document.getElementById("topUserPill");
    if (topPill) setBgImage(topPill, dataUrl);

    setStatus("Klart! Profilbilden sparas lokalt i webbläsaren.");
  } catch (err) {
    console.error(err);
    setStatus("Något gick fel vid uppladdning. Testa en annan bild.");
  }
}

function boot() {
  // Ladda ev. sparad avatar först
  loadExisting();

  const input = document.getElementById("profile-avatar-input");
  if (!input) return;

  input.addEventListener("change", onFileChange);

  // Extra: klick på preview öppnar file picker (nice UX)
  const preview = document.getElementById("profile-avatar-preview");
  if (preview) {
    preview.style.cursor = "pointer";
    preview.addEventListener("click", () => input.click());
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
// backend/services/blocketScraper.js
// ----------------------------------
// Blocket-scraping är PAUSAD i denna version.
// Vi exporterar samma funktioner men utan Playwright,
// så att backend inte kraschar vid require().

console.log("ℹ️ Blocket-scraper är avstängd (stub-version).");

// Dummy-funktion för initial sync
async function performInitialBlocketSync(profileId) {
  console.log(`ℹ️ Blocket initial sync kallad för profil ${profileId} (inaktiv).`);
  return { ok: true, message: "Blocket-scraping är avstängd." };
}

// Dummy-funktion för listings
async function fetchBlocketListings(context, profileId) {
  console.log(`ℹ️ Blocket listings kallad för profil ${profileId} (inaktiv).`);
  return [];
}

module.exports = {
  performInitialBlocketSync,
  fetchBlocketListings
};

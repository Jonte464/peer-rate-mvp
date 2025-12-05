// frontend/modules/profileEbay.js
// Hanterar eBay-kopplingen på "Min profil"-sidan (frontend-sida)
// MVP: en knapp "Koppla eBay-konto" som anropar backend och redirectar till eBay OAuth.

import { showNotification } from './utils.js';
import auth from './auth.js';

/**
 * Hämtar e-post för nuvarande inloggade användare.
 * Försöker först med user.email, annars subjectRef.
 */
function getCurrentUserEmail() {
  try {
    const user = auth.getUser();
    if (!user) return null;
    const email =
      (user.email && String(user.email).trim()) ||
      (user.subjectRef && String(user.subjectRef).trim()) ||
      null;
    return email;
  } catch (err) {
    console.error('getCurrentUserEmail error', err);
    return null;
  }
}

/**
 * Initierar eBay-sektionen om rätt element finns i DOM.
 * Förväntar sig:
 *  - En knapp med id="ebay-connect-btn"
 *  - Ett status-element med id="ebay-status" (valfritt, används för notiser)
 *
 * Om elementen inte finns gör funktionen ingenting (så vi kan lägga till HTML senare).
 */
export async function initEbaySection() {
  try {
    const btn = document.getElementById('ebay-connect-btn');
    const statusElId = 'ebay-status'; // används för showNotification

    if (!btn) {
      // Ingen eBay-knapp på sidan → gör inget.
      return;
    }

    // Om användaren inte är inloggad ska knappen egentligen inte synas,
    // men om den ändå gör det kan vi skydda här.
    const email = getCurrentUserEmail();
    if (!email) {
      btn.disabled = true;
      btn.textContent = 'Logga in för att koppla eBay';
      return;
    }

    // Sätt standardtext om knappen inte har någon text
    if (!btn.textContent || btn.textContent.trim() === '') {
      btn.textContent = 'Koppla eBay-konto';
    }

    // Se till att vi inte binder dubbla event-lyssnare
    if (btn._ebayClickBound) {
      return;
    }
    btn._ebayClickBound = true;

    btn.addEventListener('click', async () => {
      const currentEmail = getCurrentUserEmail();
      if (!currentEmail) {
        showNotification(
          'error',
          'Du måste vara inloggad för att koppla ditt eBay-konto.',
          statusElId
        );
        return;
      }

      try {
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Kopplar eBay...';

        const response = await fetch('/api/integrations/ebay/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: currentEmail }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || data.ok === false || !data.redirectUrl) {
          const msg =
            (data && (data.error || data.message)) ||
            'Kunde inte skapa eBay-koppling. Försök igen om en stund.';
          showNotification('error', msg, statusElId);
          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }

        // Allt ser bra ut → redirect till eBay OAuth
        window.location.href = data.redirectUrl;
      } catch (err) {
        console.error('eBay connect frontend error', err);
        showNotification(
          'error',
          'Tekniskt fel vid eBay-koppling. Försök igen om en stund.',
          statusElId
        );
        btn.disabled = false;
        // Vi rör inte texten här om den redan ändrats, men vi kan försöka återställa lite
        btn.textContent = 'Koppla eBay-konto';
      }
    });
  } catch (err) {
    console.error('initEbaySection error', err);
  }
}

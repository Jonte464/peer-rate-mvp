// frontend/modules/landing/init.js
import { initLandingMenu } from './menu.js';
import { initLandingLanguage } from './language.js';
import { initReputationFlip } from './reputationFlip.js';
import { initReportFlagToggle } from './reportFlag.js';
import { initKpis } from './kpis.js';
import { initValueBoxes } from './valueBoxes.js';
import { initProfileExample } from './profileExample.js';

export function initLanding() {
  initLandingMenu();
  initLandingLanguage();
  initReputationFlip();
  initReportFlagToggle();
  initKpis();
  initValueBoxes();
  // Inject a live example of the profile Trust Card (reused from /profile.html)
  initProfileExample();
}

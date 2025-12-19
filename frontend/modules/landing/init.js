// frontend/modules/landing/init.js
import { initLandingMenu } from './menu.js';
import { initLandingLanguage } from './language.js';
import { initReputationFlip } from './reputationFlip.js';
import { initTwoSliderSimulator } from './simulator.js';
import { initReportFlagToggle } from './reportFlag.js';
import { initKpis } from './kpis.js';

export function initLanding() {
  initLandingMenu();
  initLandingLanguage();
  initReputationFlip();
  initTwoSliderSimulator();
  initReportFlagToggle();
  initKpis();
}

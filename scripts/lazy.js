import ENV from './utils/env.js';
import { getConfig, loadStyle } from './ak.js';

const CONSENT_KEY = 'cookie-consent';

async function loadCookieConsent() {
  if (localStorage.getItem(CONSENT_KEY)) return;
  const { codeBase } = getConfig();
  await loadStyle(`${codeBase}/blocks/cookie-consent/cookie-consent.css`);
  const { renderBanner } = await import('../blocks/cookie-consent/cookie-consent.js');
  renderBanner();
}

async function loadSidekick() {
  const getSk = () => document.querySelector('aem-sidekick');

  const sk = getSk() || await new Promise((resolve) => {
    document.addEventListener('sidekick-ready', () => resolve(getSk()));
  });
  if (sk) import('../tools/sidekick/sidekick.js').then((mod) => mod.default(sk));
}

(function loadLazy() {
  import('./utils/lazyhash.js');
  import('./utils/favicon.js');
  import('./utils/footer.js').then(({ default: footer }) => footer());
  loadCookieConsent();

  const { codeBase } = getConfig();
  loadStyle(`${codeBase}/styles/image-expander.css`).then(() => {
    import('./utils/image-expander.js').then((mod) => mod.default());
  });

  // Author facing tools
  if (ENV !== 'prod') {
    import('../tools/scheduler/scheduler.js');
    loadSidekick();
  }
}());

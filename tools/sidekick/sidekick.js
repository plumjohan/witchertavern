import toggleScheduler from '../scheduler/scheduler.js';
import initQuickEdit from '../quick-edit/quick-edit.js';
import initRecipeSchema from './recipe-schema.js';

const ALGOLIA_INDEX_ENDPOINT = 'https://ak-website.vzrivpaket22.workers.dev/algolia-index';

async function onPublished({ detail }) {
  const path = detail?.path ?? window.location.pathname;
  try {
    await fetch(ALGOLIA_INDEX_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
      keepalive: true,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[algolia] indexing failed:', e);
  }
}

export default async function init(sk) {
  // Handle button clicks
  sk.addEventListener('custom:scheduler', toggleScheduler);
  sk.addEventListener('custom:quick-edit', initQuickEdit);
  sk.addEventListener('custom:recipe-schema', initRecipeSchema);

  // Index published pages in Algolia
  sk.addEventListener('updated', onPublished);

  // Show after all decoration is finished
  sk.classList.add('is-ready');
}

import { loadArea, setConfig } from './ak.js';
import loadBreadcrumbs from './utils/breadcrumbs.js';

const hostnames = ['authorkit.dev'];

const locales = {
  '': { lang: 'uk' },
  '/en': { lang: 'en' },
};

const linkBlocks = [
  { fragment: '/fragments/' },
  { schedule: '/schedules/' }
];

// Blocks with self-managed styles
const components = ['fragment', 'schedule'];

// How to decorate an area before loading it
const decorateArea = ({ area = document }) => {
  const eagerLoad = (parent, selector) => {
    const img = parent.querySelector(selector);
    if (!img) return;
    img.removeAttribute('loading');
    img.fetchPriority = 'high';
  };

  eagerLoad(area, 'img');
};

export async function loadPage() {
  setConfig({ hostnames, locales, linkBlocks, components, decorateArea });
  await Promise.all([loadArea(), loadBreadcrumbs()]);
}
await loadPage();

(function da() {
  const { searchParams } = new URL(window.location.href);
  const hasPreview = searchParams.has('dapreview');
  if (hasPreview) import('../tools/da/da.js').then((mod) => mod.default(loadPage));
  const hasQE = searchParams.has('quick-edit');
  if (hasQE) import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default());
}());

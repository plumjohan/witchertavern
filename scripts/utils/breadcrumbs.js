import { getConfig, getMetadata, loadStyle } from '../ak.js';
import { i18n } from './placeholders.js';

const DEFAULT_INDEX = '/main/query-index.json';

// Module-level cache: url → Promise<Map<path, header>>
const indexCache = new Map();

function fetchIndex(url) {
  if (!indexCache.has(url)) {
    const promise = fetch(url)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const map = new Map();
        for (const row of (json.data ?? [])) {
          if (row.path) map.set(row.path, row.header || row.title);
        }
        return map;
      })
      .catch(() => new Map());
    indexCache.set(url, promise);
  }
  return indexCache.get(url);
}

function formatSlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function injectJsonLd(crumbs) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(({ path, name }, i) => {
      const item = { '@type': 'ListItem', position: i + 1, name };
      if (i < crumbs.length - 1) item.item = `${window.location.origin}${path}`;
      return item;
    }),
  });
  document.head.append(script);
}

function buildDom(crumbs) {
  const nav = document.createElement('nav');
  nav.className = 'breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');
  const ol = document.createElement('ol');

  for (const { path, name, isLast } of crumbs) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = path;
    a.textContent = name;
    if (isLast) a.setAttribute('aria-current', 'page');
    li.append(a);
    ol.append(li);
  }

  nav.append(ol);
  return nav;
}

export default async function loadBreadcrumbs() {
  if (getMetadata('breadcrumb-enabled') !== 'true') return;

  const indexUrl = getMetadata('breadcrumb-path') || DEFAULT_INDEX;
  const { locale, codeBase } = getConfig();
  const prefix = locale?.prefix ?? '';

  const [index] = await Promise.all([
    fetchIndex(indexUrl),
    loadStyle(`${codeBase}/styles/breadcrumbs.css`),
  ]);

  const { pathname } = window.location;
  const clean = pathname.replace(prefix, '').replace(/^\/|\/$/g, '');
  const segments = clean ? clean.split('/') : [];

  if (segments.length < 1) return;

  const homePath = prefix || '/';
  const homeName = await i18n('crumb-home-page-name', 'Корчма Відьмака');
  const crumbs = [{ path: homePath, name: homeName, isLast: false }];

  const showCurrentPage = getMetadata('breadcrumb-current-page') !== 'disabled';

  let accPath = prefix;
  for (const [i, seg] of segments.entries()) {
    accPath += `/${seg}`;
    const isLast = i === segments.length - 1;
    if (isLast) {
      if (showCurrentPage) {
        const name = index.get(accPath)
          || document.querySelector('main h1')?.textContent?.trim()
          || formatSlug(seg);
        crumbs.push({ path: accPath, name, isLast: true });
      }
      break;
    }
    const name = index.get(accPath) || formatSlug(seg);
    crumbs.push({ path: accPath, name, isLast: false });
  }

  injectJsonLd(crumbs);

  const main = document.querySelector('main');
  if (main) main.insertBefore(buildDom(crumbs), main.firstElementChild);
}

/**
 * Recipe Search block
 *
 * Facet filter sidebar + result grid powered by a swappable search provider.
 * The provider is selected via page Metadata:
 *
 *   search-source: algolia      (default)
 *   search-source: query-index
 *
 * Algolia provider config (Metadata):
 *   algolia-search-key  — search-only API key (required)
 *   algolia-app-id      — App ID   (default: Q2XOYHGPQV)
 *   algolia-index       — index name (default: witchertavern_recipes_dev)
 *
 * Query-index provider config (Metadata):
 *   query-index-url     — JSON endpoint (default: /recipes/query-index.json)
 *
 * URL params (read on load, written on every state change):
 *   q          — search text
 *   page       — page number, 1-indexed
 *   category   — repeatable facet value
 *   difficulty — repeatable facet value
 *   world      — repeatable facet value
 *   cook       — repeatable cook-time bucket value
 *
 * Facet groups:
 *   Category, Difficulty, Universe  — provider facets (OR within, AND between)
 *   Cook Time                       — client-side bucket: <30 / 30–60 / 60+ min
 *
 * Mobile: sidebar becomes a slide-up bottom sheet triggered by a "Filters" button.
 */

import { getMetadata, loadStyle } from '../../scripts/ak.js';
import { createPicture } from '../../scripts/utils/picture.js';
import {
  getSearchQuery,
  SEARCH_QUERY_EVENT,
  createAlgoliaSearchProvider,
  createQueryIndexSearchProvider,
} from '../../scripts/utils/search.js';
import getPlaceholders from '../../scripts/utils/placeholders.js';
import env from '../../scripts/utils/env.js';

// ── Cook time ─────────────────────────────────────────────────────────────────

// phKey matches the key used in placeholders.json (may differ from the filter value)
const COOK_BUCKETS = [
  { label: 'Under 30 min', value: 'under-30', phKey: 'less-30', test: (m) => m < 30 },
  { label: '30–60 min', value: '30-60', phKey: '30-60', test: (m) => m >= 30 && m <= 60 },
  { label: 'Over 60 min', value: 'over-60', phKey: 'over-60', test: (m) => m > 60 },
];

// ── Placeholder helper ────────────────────────────────────────────────────────

function ph(placeholders, key, fallback) {
  return placeholders[key] || fallback;
}

function cookBucket(str) {
  const mins = parseInt(str, 10);
  if (Number.isNaN(mins)) return null;
  return COOK_BUCKETS.find((b) => b.test(mins))?.value ?? null;
}

const BUCKET_LABEL = Object.fromEntries(COOK_BUCKETS.map(({ value, label }) => [value, label]));

// ── Universe badge slugs ──────────────────────────────────────────────────────

const UNIVERSE_SLUGS = { відьмак: 'witcher', 'гра престолів': 'game-of-thrones' };

function universeSlug(u) {
  const key = u.toLowerCase().trim();
  return UNIVERSE_SLUGS[key] ?? key.replace(/\s+/g, '-').replace(/[''`]/g, '');
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

// ── URL state ─────────────────────────────────────────────────────────────────

function readUrlState() {
  const p = new URLSearchParams(window.location.search);
  return {
    query: getSearchQuery(),
    page: Math.max(0, (parseInt(p.get('page'), 10) || 1) - 1),
    category: new Set(p.getAll('category')),
    difficulty: new Set(p.getAll('difficulty')),
    world: new Set(p.getAll('world')),
    cookTime: new Set(p.getAll('cook')),
  };
}

function buildUrl(query, page, filterState) {
  const p = new URLSearchParams();
  if (query) p.set('q', query);
  if (page > 0) p.set('page', page + 1);
  filterState.category.forEach((v) => p.append('category', v));
  filterState.difficulty.forEach((v) => p.append('difficulty', v));
  filterState.world.forEach((v) => p.append('world', v));
  filterState.cookTime.forEach((v) => p.append('cook', v));
  const qs = p.toString();
  return qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
}

function syncCheckboxes(sidebar, filterState) {
  sidebar.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    const key = cb.closest('[data-key]')?.dataset.key;
    if (key && filterState[key]) cb.checked = filterState[key].has(cb.value);
  });
}

// ── Cook-time client filter (shared by both providers) ────────────────────────

function applyCookFilter(hits, set) {
  if (!set.size) return hits;
  return hits.filter((h) => set.has(cookBucket(h['cook-time'])));
}


// ── Card ──────────────────────────────────────────────────────────────────────

function buildCard(hit, placeholders = {}) {
  const card = document.createElement('a');
  card.className = 'recipe-card';
  card.href = hit.path ?? '#';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'recipe-card-image';
  if (hit.image) imgWrap.append(createPicture({ src: hit.image, alt: hit.title ?? '' }));
  if (hit.world) {
    const badge = document.createElement('span');
    badge.className = `recipe-card-badge recipe-card-badge-${universeSlug(hit.world)}`;
    badge.textContent = ph(placeholders, `facet-name.universe.${universeSlug(hit.world)}`, hit.world);
    imgWrap.append(badge);
  }

  const body = document.createElement('div');
  body.className = 'recipe-card-body';

  const h3 = document.createElement('h3');
  h3.textContent = hit.title ?? '';
  body.append(h3);

  if (hit.description) {
    const p = document.createElement('p');
    p.textContent = hit.description;
    body.append(p);
  }

  const meta = document.createElement('div');
  meta.className = 'recipe-card-meta';
  if (hit.category) {
    const pill = document.createElement('span');
    pill.className = 'recipe-card-category';
    pill.textContent = ph(placeholders, `facet-name.category.${hit.category}`, hit.category);
    meta.append(pill);
  }
  const servingsLabel = ph(placeholders, 'recipe-search.servings-count', 'Servings: ');
  const metaText = [
    hit.servings && `${servingsLabel}${hit.servings}`,
    hit.difficulty && ph(placeholders, `facet-name.difficalty.${hit.difficulty}`, hit.difficulty),
  ].filter(Boolean).join(' · ');
  if (metaText) {
    const span = document.createElement('span');
    span.className = 'recipe-card-servings';
    span.textContent = metaText;
    meta.append(span);
  }
  body.append(meta);
  card.append(imgWrap, body);
  return card;
}

// ── Facet sidebar ─────────────────────────────────────────────────────────────

function buildFacetGroup(label, stateKey, options, filterState, onChange) {
  const group = document.createElement('div');
  group.className = 'rs-facet-group';
  group.dataset.key = stateKey;

  const h3 = document.createElement('h3');
  h3.className = 'rs-facet-label';
  h3.textContent = label;
  group.append(h3);

  const ul = document.createElement('ul');
  ul.className = 'rs-facet-options';
  options.forEach(({ label: optLabel, value }) => {
    const li = document.createElement('li');
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = value;
    cb.checked = filterState[stateKey].has(value);
    cb.addEventListener('change', () => {
      if (cb.checked) filterState[stateKey].add(value);
      else filterState[stateKey].delete(value);
      onChange();
    });
    const span = document.createElement('span');
    span.textContent = optLabel;
    lbl.append(cb, span);
    li.append(lbl);
    ul.append(li);
  });

  group.append(ul);
  return group;
}

function buildSidebar(facetValues, filterState, onChange, placeholders = {}) {
  const aside = document.createElement('aside');
  aside.className = 'rs-sidebar';

  const mobileHeader = document.createElement('div');
  mobileHeader.className = 'rs-sidebar-mobile-header';
  const mobileTitle = document.createElement('span');
  mobileTitle.textContent = ph(placeholders, 'recipe-search.filters', 'Filters');
  const mobileClose = document.createElement('button');
  mobileClose.type = 'button';
  mobileClose.className = 'rs-sidebar-close';
  mobileClose.setAttribute('aria-label', ph(placeholders, 'recipe-search.close-filters', 'Close filters'));
  mobileHeader.append(mobileTitle, mobileClose);
  aside.append(mobileHeader);

  const groups = [
    {
      label: ph(placeholders, 'facet-name.category', 'Category'),
      key: 'category',
      opts: facetValues.category.map((v) => ({ label: ph(placeholders, `facet-name.category.${v}`, v), value: v })),
    },
    {
      label: ph(placeholders, 'facet-name.difficalty', 'Difficulty'),
      key: 'difficulty',
      opts: facetValues.difficulty.map((v) => ({ label: ph(placeholders, `facet-name.difficalty.${v}`, v), value: v })),
    },
    {
      label: ph(placeholders, 'facet-name.universe', 'Universe'),
      key: 'world',
      opts: facetValues.world.map((v) => ({ label: ph(placeholders, `facet-name.universe.${v}`, v), value: v })),
    },
    {
      label: ph(placeholders, 'facet-name.cook-time', 'Cook Time'),
      key: 'cookTime',
      opts: COOK_BUCKETS.map(({ label, value, phKey }) => ({ label: ph(placeholders, `facet-name.cook-time.${phKey}`, label), value })),
    },
  ];

  groups
    .filter((g) => g.opts.length > 0)
    .forEach((g) => aside.append(buildFacetGroup(g.label, g.key, g.opts, filterState, onChange)));

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'rs-sidebar-apply';
  applyBtn.textContent = 'Show results';
  aside.append(applyBtn);

  return { el: aside, applyBtn, closeBtn: mobileClose };
}

// ── Active filter tags ────────────────────────────────────────────────────────

const TAG_PH_PREFIX = {
  category: 'facet-name.category',
  difficulty: 'facet-name.difficalty',
  world: 'facet-name.universe',
};

function tagLabel(key, value, placeholders) {
  if (key === 'cookTime') {
    const bucket = COOK_BUCKETS.find((b) => b.value === value);
    return bucket
      ? ph(placeholders, `facet-name.cook-time.${bucket.phKey}`, BUCKET_LABEL[value] ?? value)
      : value;
  }
  const prefix = TAG_PH_PREFIX[key];
  if (prefix) return ph(placeholders, `${prefix}.${value}`, value);
  return value;
}

function buildActiveTags(filterState, onChange, placeholders = {}) {
  const bar = document.createElement('div');
  bar.className = 'rs-active-tags';

  const tags = [];
  Object.entries(filterState).forEach(([key, set]) => {
    set.forEach((value) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rs-tag';
      const text = document.createTextNode(tagLabel(key, value, placeholders));
      const x = document.createElement('span');
      x.className = 'rs-tag-x';
      x.setAttribute('aria-hidden', 'true');
      x.textContent = '×';
      btn.append(text, x);
      btn.addEventListener('click', () => {
        set.delete(value);
        onChange();
      });
      tags.push(btn);
    });
  });

  if (tags.length > 1) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'rs-tag rs-tag-clear';
    clearBtn.textContent = ph(placeholders, 'recipe-search.clear-all-label', 'Clear all')
    clearBtn.addEventListener('click', () => {
      Object.values(filterState).forEach((s) => s.clear());
      onChange();
    });
    tags.push(clearBtn);
  }

  bar.hidden = tags.length === 0;
  bar.replaceChildren(...tags);
  return bar;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function buildPagination(currentPage, totalPages, onPage) {
  const nav = document.createElement('nav');
  nav.className = 'rs-pagination';
  nav.setAttribute('aria-label', 'Recipe pages');
  nav.hidden = totalPages <= 1;
  if (totalPages <= 1) return nav;

  // Prev
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'rs-page-btn';
  prev.setAttribute('aria-label', 'Previous page');
  prev.textContent = '←';
  if (currentPage === 0) prev.disabled = true;
  else prev.addEventListener('click', () => onPage(currentPage - 1));
  nav.append(prev);

  // Page numbers with ellipsis
  const pages = [];
  for (let i = 0; i < totalPages; i += 1) {
    const near = Math.abs(i - currentPage) <= 1;
    const edge = i === 0 || i === totalPages - 1;
    if (near || edge) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== null) {
      pages.push(null);
    }
  }

  pages.forEach((p) => {
    if (p === null) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'rs-page-ellipsis';
      ellipsis.textContent = '…';
      nav.append(ellipsis);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rs-page-btn';
    if (p === currentPage) btn.classList.add('rs-page-btn--current');
    btn.textContent = p + 1;
    if (p !== currentPage) btn.addEventListener('click', () => onPage(p));
    nav.append(btn);
  });

  // Next
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'rs-page-btn';
  next.setAttribute('aria-label', 'Next page');
  next.textContent = '→';
  if (currentPage === totalPages - 1) next.disabled = true;
  else next.addEventListener('click', () => onPage(currentPage + 1));
  nav.append(next);

  return nav;
}

// ── Main decorate ─────────────────────────────────────────────────────────────

export default async function decorate(block) {
  // Load shared card styles (recipe-cards block may not be on this page)
  loadStyle('/blocks/recipe-cards/recipe-cards.css');

  // ── Provider selection ─────────────────────────────────────
  const source = getMetadata('search-source') || 'algolia';
  let provider;

  if (source === 'query-index') {
    const indexUrl = getMetadata('query-index-url') || '/recipes/query-index.json';
    provider = createQueryIndexSearchProvider(indexUrl);
  } else {
    provider = createAlgoliaSearchProvider({
      appId: getMetadata('algolia-app-id') || 'Q2XOYHGPQV',
      searchKey: getMetadata('algolia-search-key') ?? '',
      indexName: getMetadata(`algolia-index-${env()}`) || 'witchertavern_recipes_dev',
    });
  }

  block.replaceChildren();

  // ── State — seeded from URL params ────────────────────────
  const urlState = readUrlState();
  let currentQuery = urlState.query;
  let currentPage = urlState.page;
  const filterState = {
    category: urlState.category,
    difficulty: urlState.difficulty,
    world: urlState.world,
    cookTime: urlState.cookTime,
  };

  // ── Initial provider fetch + placeholders (parallel) ──────────────────────
  let initialHits = [];
  let facetValues = { category: [], difficulty: [], world: [] };
  let placeholders = {};
  try {
    ([{ hits: initialHits, facetValues }, placeholders] = await Promise.all([
      provider.init(),
      getPlaceholders(),
    ]));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recipe-search]', err);
  }

  // ── Sidebar ────────────────────────────────────────────────
  // eslint-disable-next-line prefer-const
  let doRefresh = () => {};

  const { el: sidebar, applyBtn, closeBtn: sidebarCloseBtn } = buildSidebar(
    facetValues,
    filterState,
    () => {
      currentPage = 0;
      doRefresh();
    },
    placeholders,
  );

  // ── Overlay ────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'rs-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  function openFilters() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeFilters() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  sidebarCloseBtn.addEventListener('click', closeFilters);
  applyBtn.addEventListener('click', closeFilters);
  overlay.addEventListener('click', closeFilters);

  // ── Filter toggle (mobile) ─────────────────────────────────
  const filterToggle = document.createElement('button');
  filterToggle.type = 'button';
  filterToggle.className = 'rs-filter-toggle';
  filterToggle.textContent = ph(placeholders, 'recipe-search.filters', 'Filters');
  filterToggle.addEventListener('click', openFilters);

  // ── Active tags ────────────────────────────────────────────
  let activeTagsEl = buildActiveTags(filterState, () => {
    currentPage = 0;
    doRefresh();
  }, placeholders);

  // ── Results area ───────────────────────────────────────────
  const resultsWrap = document.createElement('div');
  resultsWrap.className = 'rs-results';

  const countEl = document.createElement('p');
  countEl.className = 'rs-count';

  const grid = document.createElement('div');
  grid.className = 'rs-grid';

  const emptyEl = document.createElement('p');
  emptyEl.className = 'rs-empty';
  emptyEl.textContent = 'No recipes found in the tavern archives…';
  emptyEl.hidden = true;

  let paginationEl = document.createElement('nav');
  paginationEl.className = 'rs-pagination';
  paginationEl.hidden = true;

  resultsWrap.append(countEl, grid, emptyEl, paginationEl);

  // ── Render helper ──────────────────────────────────────────
  function renderResults(hits, { push = false, skipHistory = false } = {}) {
    const filtered = applyCookFilter(hits, filterState.cookTime);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
    const pageHits = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    // Update URL after currentPage is clamped
    if (!skipHistory) {
      const url = buildUrl(currentQuery, currentPage, filterState);
      if (push) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    }

    grid.replaceChildren(...pageHits.map((hit) => buildCard(hit, placeholders)));
    emptyEl.hidden = filtered.length > 0;
    countEl.textContent = placeholders['recipe-search.recipes-found-label'] + filtered.length;

    const newPagination = buildPagination(currentPage, totalPages, (page) => {
      currentPage = page;
      doRefresh({ push: true });
    });
    paginationEl.replaceWith(newPagination);
    paginationEl = newPagination;

    const newTags = buildActiveTags(filterState, () => {
      currentPage = 0;
      doRefresh();
    }, placeholders);
    activeTagsEl.replaceWith(newTags);
    activeTagsEl = newTags;

    const filtersLabel = ph(placeholders, 'recipe-search.filters', 'Filters');
    const n = Object.values(filterState).reduce((sum, s) => sum + s.size, 0);
    filterToggle.textContent = n > 0 ? `${filtersLabel} (${n})` : filtersLabel;
    filterToggle.classList.toggle('rs-filter-toggle--active', n > 0);
    
    applyBtn.textContent = `${ph(placeholders, 'recipe-search.show-results', 'Show results: ')}${filtered.length}`
  }

  // ── Refresh — queries provider then re-renders ─────────────
  doRefresh = async ({ push = false, skipHistory = false } = {}) => {
    try {
      const { hits } = await provider.query(currentQuery, filterState);
      renderResults(hits, { push, skipHistory });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[recipe-search]', err);
    }
  };

  // ── Browser back / forward ────────────────────────────────
  window.addEventListener('popstate', async () => {
    const state = readUrlState();
    currentQuery = state.query;
    currentPage = state.page;
    filterState.category = state.category;
    filterState.difficulty = state.difficulty;
    filterState.world = state.world;
    filterState.cookTime = state.cookTime;
    syncCheckboxes(sidebar, filterState);
    await doRefresh({ skipHistory: true });
  });

  // ── Search query from search-input block ──────────────────
  window.addEventListener(SEARCH_QUERY_EVENT, (e) => {
    e.preventDefault();
    currentQuery = e.detail.query;
    currentPage = 0;
    doRefresh();
  });

  // ── Initial render ─────────────────────────────────────────
  // If URL has state, re-query with those filters; otherwise use init hits directly.
  const hasUrlState = currentQuery || currentPage > 0
    || Object.values(filterState).some((s) => s.size > 0);
  if (hasUrlState) {
    await doRefresh({ skipHistory: true });
  } else {
    renderResults(initialHits, { skipHistory: true });
  }

  // ── Layout assembly ────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'rs-body';
  body.append(sidebar, resultsWrap);

  block.append(activeTagsEl, filterToggle, body, overlay);
}

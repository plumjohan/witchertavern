import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import { setColorScheme } from '../section-metadata/section-metadata.js';
import { i18n } from '../../scripts/utils/placeholders.js';
import {
  getSearchQuery,
  navigateToSearch,
  createAlgoliaSuggestProvider,
  createQueryIndexSuggestProvider,
} from '../../scripts/utils/search.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';
const HEADER_ACTIONS = [
  '/tools/widgets/scheme',
  '/tools/widgets/language',
  '/tools/widgets/toggle',
];

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 300;
const SEARCH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;


function closeAllMenus() {
  const openMenus = document.body.querySelectorAll('header .is-open');
  for (const openMenu of openMenus) {
    openMenu.classList.remove('is-open');
  }
}

function docClose(e) {
  if (e.target.closest('header')) return;
  closeAllMenus();
}

function toggleMenu(menu) {
  const isOpen = menu.classList.contains('is-open');
  closeAllMenus();
  if (isOpen) {
    document.removeEventListener('click', docClose);
    return;
  }

  // Setup the global close event
  document.addEventListener('click', docClose);
  menu.classList.add('is-open');
}

function decorateLanguage(btn) {
  const section = btn.closest('.section');
  btn.addEventListener('click', async () => {
    let menu = section.querySelector('.language.menu');
    if (!menu) {
      const content = document.createElement('div');
      content.classList.add('block-content');
      const fragment = await loadFragment(`${locale.prefix}${HEADER_PATH}/languages`);
      menu = document.createElement('div');
      menu.className = 'language menu';
      menu.append(fragment);
      content.append(menu);
      section.append(content);
    }
    toggleMenu(section);
  });
}

function decorateScheme(btn) {
  btn.addEventListener('click', async () => {
    const { body } = document;

    let currPref = localStorage.getItem('color-scheme');
    if (!currPref) {
      currPref = matchMedia('(prefers-color-scheme: dark)')
        .matches ? 'dark-scheme' : 'light-scheme';
    }

    const theme = currPref === 'dark-scheme'
      ? { add: 'light-scheme', remove: 'dark-scheme' }
      : { add: 'dark-scheme', remove: 'light-scheme' };

    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    localStorage.setItem('color-scheme', theme.add);
    // Re-calculatie section schemes
    const sections = document.querySelectorAll('.section');
    for (const section of sections) {
      setColorScheme(section);
    }
  });
}

function decorateNavToggle(btn) {
  btn.addEventListener('click', () => {
    const header = document.body.querySelector('header');
    if (header) header.classList.toggle('is-mobile-open');
  });
}

async function decorateAction(header, pattern) {
  const link = header.querySelector(`[href*="${pattern}"]`);
  if (!link) return;

  const icon = link.querySelector('.icon');
  const text = link.textContent;
  const btn = document.createElement('button');
  if (icon) btn.append(icon);
  if (text) {
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = text;
    btn.append(textSpan);
  }
  const wrapper = document.createElement('div');
  wrapper.className = `action-wrapper ${icon.classList[1].replace('icon-', '')}`;
  wrapper.append(btn);
  link.parentElement.parentElement.replaceChild(wrapper, link.parentElement);

  if (pattern === '/tools/widgets/language') decorateLanguage(btn);
  if (pattern === '/tools/widgets/scheme') decorateScheme(btn);
  if (pattern === '/tools/widgets/toggle') decorateNavToggle(btn);
}

async function decorateSearch(section, searchProvider) {
  const defaultContent = section.querySelector(':scope > .default-content');
  if (!defaultContent) return;

  const icon = () => {
    const span = document.createElement('span');
    span.innerHTML = SEARCH_ICON;
    return span.firstElementChild;
  };

  // Mobile toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'search-toggle';
  toggleBtn.setAttribute('aria-label', 'Search');
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.append(icon());

  // Form
  const inputPlaceholder = await i18n('search-input-field.placeholder-text', 'Search recipes…');
  const form = document.createElement('form');
  form.className = 'hs-form';
  form.setAttribute('role', 'search');

  const iconBtn = document.createElement('button');
  iconBtn.type = 'submit';
  iconBtn.className = 'hs-icon-btn';
  iconBtn.setAttribute('aria-label', 'Search');
  iconBtn.append(icon());

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'hs-input';
  input.placeholder = inputPlaceholder;
  input.setAttribute('aria-label', inputPlaceholder);
  input.setAttribute('autocomplete', 'off');
  input.value = getSearchQuery();

  form.append(iconBtn, input);

  // Suggestions list
  const suggestionsList = document.createElement('ul');
  suggestionsList.className = 'hs-suggestions';
  suggestionsList.setAttribute('role', 'listbox');
  suggestionsList.hidden = true;

  // Panel
  const panel = document.createElement('div');
  panel.className = 'header-search';
  panel.append(form, suggestionsList);

  // Wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'action-wrapper search';
  wrapper.append(toggleBtn, panel);

  const langWrapper = defaultContent.querySelector('.action-wrapper.language');
  if (langWrapper) {
    defaultContent.insertBefore(wrapper, langWrapper);
  } else {
    defaultContent.prepend(wrapper);
  }

  // ── Suggestions state ──────────────────────────────────────────────────────

  let timer;
  let activeIndex = -1;
  let currentItems = [];

  function renderSuggestions(items) {
    currentItems = items;
    activeIndex = -1;
    suggestionsList.replaceChildren();

    if (!items.length) {
      suggestionsList.hidden = true;
      return;
    }

    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'hs-suggestion';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');

      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 48;
        img.height = 48;
        li.append(img);
      }

      const info = document.createElement('div');
      info.className = 'hs-suggestion-info';

      const title = document.createElement('span');
      title.className = 'hs-suggestion-title';
      title.textContent = item.title;
      info.append(title);

      if (item.category) {
        const cat = document.createElement('span');
        cat.className = 'hs-suggestion-category';
        cat.textContent = item.category;
        info.append(cat);
      }

      li.append(info);

      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keep focus on input until navigation
        window.location.href = item.path;
      });

      suggestionsList.append(li);
    }

    suggestionsList.hidden = false;
  }

  function setActive(index) {
    const items = [...suggestionsList.querySelectorAll('.hs-suggestion')];
    items.forEach((el, i) => el.classList.toggle('is-active', i === index));
    activeIndex = index;
  }

  function closeSuggestions() {
    suggestionsList.hidden = true;
    activeIndex = -1;
    currentItems = [];
  }

  // ── Input events ───────────────────────────────────────────────────────────

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const val = input.value.trim();

    if (val.length < MIN_QUERY_LEN) {
      closeSuggestions();
      return;
    }

    timer = setTimeout(async () => {
      renderSuggestions(await searchProvider(val));
    }, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    const items = [...suggestionsList.querySelectorAll('.hs-suggestion')];
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      window.location.href = currentItems[activeIndex].path;
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(closeSuggestions, 150);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timer);
    closeSuggestions();
    const val = input.value.trim();
    navigateToSearch('/search', val);
  });

  // ── Mobile toggle ──────────────────────────────────────────────────────────

  toggleBtn.addEventListener('click', () => {
    toggleMenu(wrapper);
    const isOpen = wrapper.classList.contains('is-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) input.focus();
  });

  window.addEventListener('popstate', () => {
    input.value = getSearchQuery();
  });
}

function decorateMenu() {
  // TODO: finish single menu support
  return null;
}

function decorateMegaMenu(li) {
  const menu = li.querySelector('.fragment-content');
  if (!menu) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'mega-menu';
  wrapper.append(menu);
  li.append(wrapper);
  return wrapper;
}

function decorateNavItem(li) {
  li.classList.add('main-nav-item');
  const link = li.querySelector(':scope > p > a');
  if (link) link.classList.add('main-nav-link');
  const menu = decorateMegaMenu(li) || decorateMenu(li);
  if (!(menu || link)) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMenu(li);
  });
}

function decorateBrandSection(section) {
  section.classList.add('brand-section');
  const brandLink = section.querySelector('a');
  const [, text] = brandLink.childNodes;
  const span = document.createElement('span');
  span.className = 'brand-text';
  span.append(text);
  brandLink.append(span);
}

function decorateNavSection(section) {
  section.classList.add('main-nav-section');
  const navContent = section.querySelector('.default-content');
  const navList = section.querySelector('ul');
  if (!navList) return;
  navList.classList.add('main-nav-list');

  const nav = document.createElement('nav');
  nav.append(navList);
  navContent.append(nav);

  const mainNavItems = section.querySelectorAll('nav > ul > li');
  for (const navItem of mainNavItems) {
    decorateNavItem(navItem);
  }
}

async function decorateActionSection(section) {
  section.classList.add('actions-section');
}

async function decorateHeader(fragment, searchProvider) {
  const sections = fragment.querySelectorAll(':scope > .section');
  if (sections[0]) decorateBrandSection(sections[0]);
  if (sections[1]) decorateNavSection(sections[1]);
  if (sections[2]) decorateActionSection(sections[2]);

  for (const pattern of HEADER_ACTIONS) {
    decorateAction(fragment, pattern);
  }

  if (sections[2]) decorateSearch(sections[2], searchProvider);
}

/**
 * loads and decorates the header
 * @param {Element} el The header element
 */
export default async function init(el) {
  const headerMeta = getMetadata('header');
  const path = headerMeta || HEADER_PATH;
  try {
    const [fragment] = await Promise.all([
      loadFragment(`${locale.prefix}${path}`)
    ]);
    const searchKey = getMetadata('algolia-search-key');
    const searchProvider = searchKey
      ? createAlgoliaSuggestProvider(
          getMetadata('algolia-app-id') || 'Q2XOYHGPQV',
          searchKey,
          getMetadata('algolia-index') || 'witchertavern_recipes_dev',
        )
      : createQueryIndexSuggestProvider(
          getMetadata('query-index-url') || '/recipes/query-index.json',
        );
    fragment.classList.add('header-content');
    await decorateHeader(fragment, searchProvider);
    el.append(fragment);
  } catch (e) {
    throw Error(e);
  }
}

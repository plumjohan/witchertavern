/**
 * Recipe Ingredients block
 *
 * Turns a bullet list into interactive checkboxes. Checked state is persisted
 * in a cookie (30-day expiry) so users can track what they already have when
 * shopping or cooking.
 *
 * Authoring: add a single-cell block containing a bullet list.
 *
 *   | recipe-ingredients |
 *   | - 400г лісових грибів |
 *   | - 150г сала            |
 *   | - 1 цибулина           |
 *   | - сіль, перець         |
 *
 * Or write the entire list as one multi-line cell — DA.live renders a <ul>.
 */

import getPlaceholders from '../../scripts/utils/placeholders.js';

const COOKIE_PREFIX = 'wt_chk_';

/**
 * Build a stable cookie key from the current pathname.
 * Keeps only a–z, 0–9, and underscores; caps at 60 chars.
 */
function cookieKey() {
  return COOKIE_PREFIX + window.location.pathname
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

function loadChecked() {
  const key = cookieKey();
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${key}=([^;]*)`),
  );
  if (!match) return new Set();
  try {
    // Values are ingredient text strings (stable across reorders)
    return new Set(JSON.parse(decodeURIComponent(match[1])));
  } catch {
    return new Set();
  }
}

function saveChecked(checked) {
  const key = cookieKey();
  const value = encodeURIComponent(JSON.stringify([...checked]));
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${key}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export default async function decorate(block) {
  const items = [...block.querySelectorAll('li')];
  if (!items.length) return;

  const checked = loadChecked();
  const ph = await getPlaceholders();

  /* ── Ingredient list ──────────────────────────────────── */
  const list = document.createElement('ul');
  list.className = 'ingredient-list';

  items.forEach((item) => {
    const text = item.textContent.trim();
    const li = document.createElement('li');
    li.className = 'ingredient-item';
    if (checked.has(text)) li.classList.add('is-checked');

    const label = document.createElement('label');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ingredient-checkbox';
    checkbox.checked = checked.has(text);
    checkbox.setAttribute('aria-label', text);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        checked.add(text);
        li.classList.add('is-checked');
      } else {
        checked.delete(text);
        li.classList.remove('is-checked');
      }
      saveChecked(checked);
    });

    const span = document.createElement('span');
    span.className = 'ingredient-text';
    span.textContent = text;

    label.append(checkbox, span);
    li.append(label);
    list.append(li);
  });

  /* ── Reset button ─────────────────────────────────────── */
  const resetBtn = document.createElement('button');
  resetBtn.className = 'ingredient-reset';
  resetBtn.textContent = ph['ingredient-reset'] ?? 'Reset all';
  resetBtn.setAttribute('type', 'button');

  resetBtn.addEventListener('click', () => {
    checked.clear();
    saveChecked(checked);
    list.querySelectorAll('.ingredient-item').forEach((li) => {
      li.classList.remove('is-checked');
      li.querySelector('input').checked = false;
    });
  });

  /* ── Assemble ─────────────────────────────────────────── */
  block.replaceChildren(list, resetBtn);
}

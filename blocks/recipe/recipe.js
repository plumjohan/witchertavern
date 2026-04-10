/**
 * Recipe block
 *
 * Input table structure (one row):
 *
 *   Row 1 — intro (two cells):
 *     Cell 1: description / quote from the book (text content)
 *     Cell 2: photo of the finished dish (<picture>)
 *
 * Stats (cook-time, servings, difficulty) come from page metadata so they
 * are indexed by Algolia without duplication:
 *
 *   | metadata    |           |
 *   | cook-time   | 45 хвилин |
 *   | servings    | 4 порції   |
 *   | difficulty  | easy       |  (easy | medium | hard)
 */

import { getMetadata } from '../../scripts/ak.js';
import getPlaceholders from '../../scripts/utils/placeholders.js';
import { createPicture } from '../../scripts/utils/picture.js';

const INTRO_BREAK = [
  { media: '(min-width: 1200px)', width: '700' },
  { media: '(min-width: 900px)', width: '600' },
  { media: '(min-width: 600px)', width: '500' },
  { width: '750' },
];

const STATS = [
  { key: 'cook-time', type: 'time' },
  { key: 'servings', type: 'servings' },
  { key: 'difficulty', type: 'difficulty' },
];

const DIFFICULTY_LEVELS = { easy: 1, medium: 2, hard: 3 };

function buildLabel(text) {
  const label = document.createElement('span');
  label.className = 'recipe-stat-label';
  label.textContent = text;
  return label;
}

function buildDifficultyStat(value, translations) {
  const level = DIFFICULTY_LEVELS[value?.toLowerCase()];
  const stat = document.createElement('div');
  stat.className = 'recipe-stat';
  stat.dataset.type = 'difficulty';

  if (translations['recipe-difficulty-label']) stat.append(buildLabel(translations['recipe-difficulty-label']));

  if (level) {
    const icons = document.createElement('div');
    icons.className = 'recipe-stat-icons';
    for (let i = 0; i < level; i += 1) {
      const icon = document.createElement('span');
      icon.className = 'recipe-stat-icon';
      icon.setAttribute('aria-hidden', 'true');
      icons.append(icon);
    }
    stat.append(icons);
  }

  const p = document.createElement('p');
  p.textContent = translations[`recipe-difficulty-${value?.toLowerCase()}`] ?? value ?? '—';
  stat.append(p);

  return stat;
}

function buildStats(translations) {
  const values = STATS.map(({ key }) => getMetadata(key));
  if (values.every((v) => !v)) return null;

  const bar = document.createElement('div');
  bar.className = 'recipe-stats';

  STATS.forEach(({ type }, i) => {
    let stat;
    if (type === 'difficulty') {
      stat = buildDifficultyStat(values[i], translations);
    } else {
      stat = document.createElement('div');
      stat.className = 'recipe-stat';
      stat.dataset.type = type;
      const labelKey = `recipe-${type}-label`;
      if (translations[labelKey]) stat.append(buildLabel(translations[labelKey]));
      const p = document.createElement('p');
      p.textContent = values[i] || '—';
      stat.append(p);
    }
    bar.append(stat);
  });

  return bar;
}

function buildIntro(row, translations) {
  const intro = document.createElement('div');
  intro.className = 'recipe-intro';

  const cells = [...row.children];
  const imgCell = cells.find((c) => c.querySelector('picture'));
  const descCell = cells.find((c) => c !== imgCell) ?? cells[0];

  // Left column: description + stats stacked
  const main = document.createElement('div');
  main.className = 'recipe-intro-main';

  if (descCell) {
    const quote = document.createElement('blockquote');
    quote.className = 'recipe-description';
    quote.append(...descCell.childNodes);
    main.append(quote);
  }

  const stats = buildStats(translations);
  if (stats) main.append(stats);

  intro.append(main);

  // Right column: dish photo
  if (imgCell) {
    const rawPicture = imgCell.querySelector('picture');
    const rawImg = rawPicture?.querySelector('img');
    const picture = createPicture({
      src: rawImg?.src ?? rawImg?.getAttribute('src') ?? '',
      alt: rawImg?.alt ?? '',
      eager: true,
      breakpoints: INTRO_BREAK,
    });
    picture.querySelector('img')?.setAttribute('fetchpriority', 'high');
    const wrapper = document.createElement('div');
    wrapper.className = 'recipe-image';
    wrapper.append(picture);
    intro.append(wrapper);
  }

  return intro;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const translations = await getPlaceholders();

  // Pull the page heading (h1/h2) from default-content into the recipe block
  // so the title sits visually next to the description and image.
  const section = block.closest('.section');
  const heading = section?.querySelector('.default-content h1, .default-content h2');

  const children = [];
  if (heading) {
    const header = document.createElement('div');
    header.className = 'recipe-header';
    header.append(heading);
    children.push(header);
  }

  if (rows[0]) children.push(buildIntro(rows[0], translations));
  block.replaceChildren(...children);
}

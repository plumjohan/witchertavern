/**
 * Recipe Cards block
 *
 * Input format per row (single cell):
 *   <div>
 *     <picture><img src="..." alt="..."/></picture>  <!-- optional, add later -->
 *     <p><a href="/recipes/..."><strong>Назва рецепту</strong></a></p>
 *     <p>Короткий опис страви</p>
 *     <p>Категорія</p>          <!-- e.g. Закуски / Супи / М'ясо / … -->
 *     <p>4 порції · Легка</p>   <!-- servings · difficulty -->
 *     <p>Відьмак</p>            <!-- universe: Відьмак | Гра Престолів -->
 *   </div>
 *
 * Block variants (add as extra class on the block div):
 *   featured  — single horizontal row, no category filter
 */

function parseRecipe(row) {
  const cell = row.querySelector(':scope > div');
  if (!cell) return null;

  const picture = cell.querySelector('picture');
  const ps = [...cell.querySelectorAll('p')];
  const link = ps[0]?.querySelector('a');
  const title = ps[0]?.querySelector('strong')?.textContent?.trim()
    ?? ps[0]?.textContent?.trim()
    ?? '';

  if (!title) return null;

  return {
    picture: picture ? picture.cloneNode(true) : null,
    href: link?.getAttribute('href') ?? '#',
    title,
    description: ps[1]?.textContent?.trim() ?? '',
    category: ps[2]?.textContent?.trim() ?? '',
    meta: ps[3]?.textContent?.trim() ?? '',
    universe: ps[4]?.textContent?.trim() ?? '',
  };
}

function buildFilter(categories, grid) {
  const bar = document.createElement('div');
  bar.className = 'recipe-cards-filter';

  const all = ['Всі', ...categories];
  all.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.dataset.filter = i === 0 ? 'all' : cat;
    if (i === 0) btn.classList.add('active');

    btn.addEventListener('click', () => {
      bar.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      grid.querySelectorAll('.recipe-card').forEach((card) => {
        // eslint-disable-next-line no-param-reassign
        card.hidden = filter !== 'all' && card.dataset.category !== filter;
      });
    });

    bar.append(btn);
  });

  return bar;
}

function universeSlug(universe) {
  return universe.toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[''`]/g, '');
}

function buildCard(recipe) {
  const card = document.createElement('a');
  card.className = 'recipe-card';
  card.href = recipe.href;
  if (recipe.category) card.dataset.category = recipe.category;

  // ── Image ───────────────────────────────────────────────
  const imgWrap = document.createElement('div');
  imgWrap.className = 'recipe-card-image';

  if (recipe.picture) {
    const img = recipe.picture.querySelector('img');
    if (img) img.loading = 'lazy';
    imgWrap.append(recipe.picture);
  }

  if (recipe.universe) {
    const badge = document.createElement('span');
    badge.className = `recipe-card-badge recipe-card-badge--${universeSlug(recipe.universe)}`;
    badge.textContent = recipe.universe;
    imgWrap.append(badge);
  }

  // ── Body ────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'recipe-card-body';

  const title = document.createElement('h3');
  title.textContent = recipe.title;
  body.append(title);

  if (recipe.description) {
    const desc = document.createElement('p');
    desc.textContent = recipe.description;
    body.append(desc);
  }

  // ── Meta ────────────────────────────────────────────────
  const meta = document.createElement('div');
  meta.className = 'recipe-card-meta';

  if (recipe.category) {
    const catPill = document.createElement('span');
    catPill.className = 'recipe-card-category';
    catPill.textContent = recipe.category;
    meta.append(catPill);
  }

  if (recipe.meta) {
    const metaSpan = document.createElement('span');
    metaSpan.className = 'recipe-card-servings';
    metaSpan.textContent = recipe.meta;
    meta.append(metaSpan);
  }

  body.append(meta);
  card.append(imgWrap, body);
  return card;
}

export default async function init(el) {
  const isFeatured = el.classList.contains('featured');
  const rows = [...el.querySelectorAll(':scope > div')];

  const recipes = rows.map(parseRecipe).filter(Boolean);
  if (!recipes.length) return;

  const grid = document.createElement('div');
  grid.className = 'recipe-cards-grid';
  recipes.forEach((recipe) => grid.append(buildCard(recipe)));

  el.innerHTML = '';

  if (!isFeatured) {
    const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))];
    if (categories.length > 1) {
      el.append(buildFilter(categories, grid));
    }
  }

  el.append(grid);
}

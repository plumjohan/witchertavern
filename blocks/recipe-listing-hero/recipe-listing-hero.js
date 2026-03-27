/**
 * Recipe Listing Hero block
 *
 * Atmospheric full-bleed hero for the recipes index page.
 * Renders candlelight glow orbs, ember particles, and a
 * staggered-reveal title section.
 *
 * Authoring structure (2 rows):
 *
 *   Row 1 — single cell:
 *     <p>Eyebrow text</p>          ← paragraph BEFORE the heading
 *     <h1>Title <em>Italic</em></h1>
 *     <p>Subtitle paragraph</p>    ← paragraph AFTER the heading
 *
 *   Row 2 — three cells (optional stats):
 *     Cell 1: <p>48</p><p>Recipes</p>
 *     Cell 2: <p>7</p><p>Categories</p>
 *     Cell 3: <p>2</p><p>Universes</p>
 */

function buildEmbers(container) {
  for (let i = 0; i < 18; i += 1) {
    const ember = document.createElement('span');
    ember.className = 'rlh-ember';
    const size = 1.5 + Math.random() * 2.5;
    ember.style.cssText = [
      `left:${5 + Math.random() * 90}%`,
      `animation-duration:${4 + Math.random() * 5}s`,
      `animation-delay:${Math.random() * 8}s`,
      `width:${size}px`,
      `height:${size}px`,
      `--drift:${(Math.random() - 0.5) * 80}px`,
      `--drift2:${(Math.random() - 0.5) * 40}px`,
    ].join(';');
    if (Math.random() > 0.75) {
      ember.style.background = 'var(--color-crimson-400, #d45050)';
      ember.style.boxShadow = '0 0 6px 2px rgba(212,80,80,0.5)';
    }
    container.append(ember);
  }
}

function buildStats(statsRow) {
  const bar = document.createElement('div');
  bar.className = 'rlh-stats';

  [...statsRow.children].forEach((cell) => {
    const ps = [...cell.querySelectorAll('p')];
    if (ps.length < 2) return;

    const stat = document.createElement('div');
    stat.className = 'rlh-stat';

    const num = document.createElement('span');
    num.className = 'rlh-stat-num';
    num.textContent = ps[0].textContent.trim();

    const label = document.createElement('span');
    label.className = 'rlh-stat-label';
    label.textContent = ps[1].textContent.trim();

    stat.append(num, label);
    bar.append(stat);
  });

  return bar.children.length ? bar : null;
}

export default function decorate(block) {
  const rows = [...block.children];
  const contentCell = rows[0]?.querySelector(':scope > div');
  const statsRow = rows[1] ?? null;

  // ── Background
  const bg = document.createElement('div');
  bg.className = 'rlh-bg';
  bg.setAttribute('aria-hidden', 'true');

  // ── Candlelight glow orbs
  const glowWrap = document.createElement('div');
  glowWrap.className = 'rlh-glows';
  glowWrap.setAttribute('aria-hidden', 'true');
  [1, 2, 3].forEach((n) => {
    const g = document.createElement('div');
    g.className = `rlh-glow rlh-glow-${n}`;
    glowWrap.append(g);
  });

  // ── Ember particles
  const embers = document.createElement('div');
  embers.className = 'rlh-embers';
  embers.setAttribute('aria-hidden', 'true');
  buildEmbers(embers);

  // ── Content
  const content = document.createElement('div');
  content.className = 'rlh-content';

  if (contentCell) {
    const heading = contentCell.querySelector('h1, h2');
    const allPs = [...contentCell.querySelectorAll(':scope > p')];

    // Sort paragraphs into eyebrow (before heading) and subtitle (after heading)
    let eyebrowP = null;
    let subtitleP = null;

    if (heading) {
      allPs.forEach((p) => {
        const pos = heading.compareDocumentPosition(p);
        // eslint-disable-next-line no-bitwise
        if (pos & Node.DOCUMENT_POSITION_PRECEDING && !eyebrowP) {
          eyebrowP = p;
        // eslint-disable-next-line no-bitwise
        } else if (pos & Node.DOCUMENT_POSITION_FOLLOWING && !subtitleP) {
          subtitleP = p;
        }
      });
    } else {
      [eyebrowP, subtitleP] = allPs;
    }

    if (eyebrowP) {
      const ew = document.createElement('p');
      ew.className = 'rlh-eyebrow';
      ew.textContent = eyebrowP.textContent.trim();
      content.append(ew);
    }

    if (heading) {
      heading.className = 'rlh-title';
      content.append(heading);
    }

    if (subtitleP) {
      subtitleP.className = 'rlh-subtitle';
      content.append(subtitleP);
    }
  }

  if (statsRow) {
    const stats = buildStats(statsRow);
    if (stats) content.append(stats);
  }

  // ── Bottom ornament line
  const ornament = document.createElement('div');
  ornament.className = 'rlh-ornament';
  ornament.setAttribute('aria-hidden', 'true');

  block.replaceChildren(bg, glowWrap, embers, content, ornament);
}

const EXPAND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="15 3 21 3 21 9"/>
  <polyline points="9 21 3 21 3 15"/>
  <line x1="21" y1="3" x2="14" y2="10"/>
  <line x1="3" y1="21" x2="10" y2="14"/>
</svg>`;

const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <line x1="18" y1="6" x2="6" y2="18"/>
  <line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

function getFullSizeSrc(picture) {
  const img = picture.querySelector('img');
  // Prefer the widest source available
  const sources = [...picture.querySelectorAll('source')];
  let best = null;
  let bestWidth = 0;
  for (const source of sources) {
    const srcset = source.getAttribute('srcset') || '';
    const match = srcset.match(/width=(\d+)/);
    const w = match ? parseInt(match[1], 10) : 0;
    if (w > bestWidth) {
      bestWidth = w;
      best = srcset.split(',')[0].trim().split(' ')[0];
    }
  }
  return best || img?.src || '';
}

function createModal() {
  const dialog = document.createElement('dialog');
  dialog.className = 'image-expander-modal';
  dialog.setAttribute('aria-modal', 'true');

  const backdrop = document.createElement('div');
  backdrop.className = 'image-expander-backdrop';

  const panel = document.createElement('div');
  panel.className = 'image-expander-panel';

  const header = document.createElement('div');
  header.className = 'image-expander-header';

  const title = document.createElement('h2');
  title.className = 'image-expander-title';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'image-expander-close';
  closeBtn.setAttribute('aria-label', 'Close image');
  closeBtn.innerHTML = CLOSE_ICON;
  closeBtn.addEventListener('click', () => dialog.close());

  header.append(title, closeBtn);

  const imgEl = document.createElement('img');
  imgEl.className = 'image-expander-full-img';
  imgEl.alt = '';

  panel.append(header, imgEl);
  backdrop.append(panel);
  dialog.append(backdrop);

  // Close on backdrop click (outside the panel)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) dialog.close();
  });

  document.body.append(dialog);
  return { dialog, title, imgEl };
}

export default function initImageExpander() {
  const pictures = document.querySelectorAll('.image-expander picture');
  if (!pictures.length) return;

  const { dialog, title, imgEl } = createModal();

  for (const picture of pictures) {
    const wrapper = picture.closest('.image-expander-wrapper') || (() => {
      const w = document.createElement('span');
      w.className = 'image-expander-wrapper';
      picture.replaceWith(w);
      w.append(picture);
      return w;
    })();

    const btn = document.createElement('button');
    btn.className = 'image-expander-btn';
    btn.setAttribute('aria-label', 'Expand image');
    btn.innerHTML = EXPAND_ICON;

    btn.addEventListener('click', () => {
      const img = picture.querySelector('img');
      const altText = img?.alt || '';
      title.textContent = altText;
      title.hidden = !altText;
      imgEl.src = getFullSizeSrc(picture);
      imgEl.alt = altText;
      dialog.showModal();
    });

    wrapper.append(btn);
  }
}

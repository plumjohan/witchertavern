/**
 * Recipe Schema Plugin for AEM Sidekick
 *
 * Generates a Recipe JSON-LD object from the current page DOM and metadata.
 * Triggered by the custom:recipe-schema sidekick event.
 *
 * Data sources:
 *   - name         → <h1>
 *   - description  → .recipe-description blockquote text
 *   - image        → og:image meta tag (falls back to .recipe-image img)
 *   - cookTime     → meta[name="cook-time"] → parsed to ISO 8601
 *   - recipeYield  → meta[name="servings"]
 *   - ingredients  → .ingredient-text items
 *   - instructions → .recipe-steps-list .step-content items
 *   - keywords     → meta[name="keywords"]
 *   - datePublished→ meta[name="publication-date"]
 *   - video.uploadDate → YouTube Data API v3 (key stored in localStorage)
 */

const DIALOG_ID = 'wt-recipe-schema-dialog';
const YT_API_KEY_STORAGE = 'wt-yt-api-key';

// ---------------------------------------------------------------------------
// Cook-time parser: "45 хвилин" / "1 годину 30 хвилин" / "45 minutes" → ISO
// ---------------------------------------------------------------------------
const TIME_PATTERNS = [
  // hours
  { re: /(\d+(?:[.,]\d+)?)\s*(?:год(?:ин(?:у|и|а)?)?|h(?:ours?)?)/i, unit: 'H' },
  // minutes
  { re: /(\d+)\s*(?:хв(?:илин(?:и|у|а)?)?|min(?:utes?)?)/i, unit: 'M' },
];

function parseCookTime(raw) {
  if (!raw) return undefined;
  let hours = 0;
  let minutes = 0;
  TIME_PATTERNS.forEach(({ re, unit }) => {
    const m = raw.match(re);
    if (!m) return;
    const val = parseFloat(m[1].replace(',', '.'));
    if (unit === 'H') {
      hours += Math.floor(val);
      minutes += Math.round((val % 1) * 60);
    } else {
      minutes += val;
    }
  });
  if (!hours && !minutes) return undefined;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}`;
}

// ---------------------------------------------------------------------------
// YouTube API key — stored in localStorage, prompted once if absent
// ---------------------------------------------------------------------------
function getYouTubeApiKey() {
  let key = localStorage.getItem(YT_API_KEY_STORAGE);
  if (!key) {
    // eslint-disable-next-line no-alert
    key = prompt(
      'Enter your YouTube Data API v3 key (stored locally in your browser, never sent to the repo):',
    );
    if (key?.trim()) {
      localStorage.setItem(YT_API_KEY_STORAGE, key.trim());
    }
  }
  return key?.trim() || null;
}

async function fetchYouTubeUploadDate(videoId) {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400 || res.status === 403) {
        // Bad or quota-exceeded key — clear it so user can re-enter next time
        localStorage.removeItem(YT_API_KEY_STORAGE);
      }
      return null;
    }
    const data = await res.json();
    return data.items?.[0]?.snippet?.publishedAt ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DOM scrapers
// ---------------------------------------------------------------------------
function getMeta(name) {
  const attr = name.includes(':') ? 'property' : 'name';
  return document.head.querySelector(`meta[${attr}="${name}"]`)?.content || '';
}

function getRecipeName() {
  return document.querySelector('h1')?.textContent.trim() || getMeta('og:title') || '';
}

function getDescription() {
  const el = document.querySelector('.recipe-description');
  return el?.textContent.trim() || getMeta('description') || getMeta('og:description') || '';
}

const PROD_HOST = 'https://witcherinn.com';

function toProdUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hostname = new URL(PROD_HOST).hostname;
    u.protocol = 'https:';
    u.port = '';
    return u.toString();
  } catch {
    return url;
  }
}

function getImage() {
  const og = getMeta('og:image');
  if (og) return toProdUrl(og);
  const img = document.querySelector('.recipe-image img');
  return toProdUrl(img?.src || '');
}

function getVideoId() {
  const iframe = document.querySelector('.video iframe.youtube');
  const src = iframe?.src
    || iframe?.getAttribute('src')
    || document.querySelector('.video[data-src]')?.dataset.src
    || '';
  const match = src.match(/embed\/([\w-]+)/);
  return match ? match[1] : null;
}

function buildVideoObject(videoId, uploadDate) {
  return {
    '@type': 'VideoObject',
    name: getRecipeName(),
    description: getDescription(),
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    ...(uploadDate && { uploadDate }),
  };
}

function getIngredients() {
  return [...document.querySelectorAll('.ingredient-text')]
    .map((el) => el.textContent.trim())
    .filter(Boolean);
}

function getInstructions() {
  return [...document.querySelectorAll('.recipe-steps-list .step-content')]
    .map((el, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: el.textContent.trim(),
    }))
    .filter((s) => s.text);
}

// ---------------------------------------------------------------------------
// Schema builder (async — needs YouTube API call)
// ---------------------------------------------------------------------------
async function buildSchema() {
  const name = getRecipeName();
  const description = getDescription();
  const image = getImage();
  const cookTimeRaw = getMeta('cook-time');
  const cookTime = parseCookTime(cookTimeRaw);
  const recipeYield = getMeta('servings');
  const keywords = getMeta('keywords');
  const datePublished = getMeta('publication-date');
  const ingredients = getIngredients();
  const instructions = getInstructions();

  const videoId = getVideoId();
  let video;
  if (videoId) {
    const uploadDate = (await fetchYouTubeUploadDate(videoId)) ?? getMeta('publication-date') ?? undefined;
    video = buildVideoObject(videoId, uploadDate);
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    ...(name && { name }),
    ...(description && { description }),
    ...(image && { image: [image] }),
    author: { 'type': 'Organization', '@id': 'https://witcherinn.com/#organization' },
    ...(datePublished && { datePublished }),
    ...(cookTime && { cookTime }),
    ...(recipeYield && { recipeYield }),
    ...(keywords && { keywords }),
    ...(ingredients.length && { recipeIngredient: ingredients }),
    ...(instructions.length && { recipeInstructions: instructions }),
    ...(video && { video }),
  };

  return JSON.stringify(schema, null, 2);
}

// ---------------------------------------------------------------------------
// Modal UI
// ---------------------------------------------------------------------------
const MODAL_CSS = `
#${DIALOG_ID} {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.55);
  font-family: monospace;
}
#${DIALOG_ID} .wt-rs-panel {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 8px;
  width: min(760px, 92vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,.6);
  overflow: hidden;
}
#${DIALOG_ID} .wt-rs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  gap: 8px;
}
#${DIALOG_ID} .wt-rs-title {
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
  font-family: sans-serif;
}
#${DIALOG_ID} .wt-rs-actions {
  display: flex;
  gap: 8px;
}
#${DIALOG_ID} button {
  font-family: sans-serif;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
#${DIALOG_ID} .wt-rs-copy {
  background: #0e639c;
  color: #fff;
}
#${DIALOG_ID} .wt-rs-copy:hover { background: #1177bb; }
#${DIALOG_ID} .wt-rs-close {
  background: #3c3c3c;
  color: #ccc;
}
#${DIALOG_ID} .wt-rs-close:hover { background: #555; }
#${DIALOG_ID} pre {
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
}
`;

function injectStyles() {
  if (document.getElementById(`${DIALOG_ID}-style`)) return;
  const style = document.createElement('style');
  style.id = `${DIALOG_ID}-style`;
  style.textContent = MODAL_CSS;
  document.head.append(style);
}

function showModal(json) {
  document.getElementById(DIALOG_ID)?.remove();
  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = DIALOG_ID;

  overlay.innerHTML = `
    <div class="wt-rs-panel">
      <div class="wt-rs-header">
        <span class="wt-rs-title">Recipe JSON-LD</span>
        <div class="wt-rs-actions">
          <button class="wt-rs-copy">Copy</button>
          <button class="wt-rs-close">Close</button>
        </div>
      </div>
      <pre></pre>
    </div>
  `;

  overlay.querySelector('pre').textContent = json;

  overlay.querySelector('.wt-rs-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('.wt-rs-copy').addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(json);
    e.target.textContent = 'Copied!';
    setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
  });

  document.body.append(overlay);
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------
export default async function initRecipeSchema() {
  // Only activate on recipe pages
  if (!document.querySelector('.recipe, .recipe-ingredients, .recipe-steps')) {
    // eslint-disable-next-line no-alert
    alert('No recipe content found on this page.');
    return;
  }

  const json = await buildSchema();
  showModal(json);
}

/**
 * Algolia indexing script
 *
 * Triggered by GitHub Actions on resource-published / resource-unpublished
 * events sent by AEM when a page is published or unpublished.
 *
 * Environment variables (set by the GitHub Action):
 *   ALGOLIA_APP_ID    — Algolia application ID
 *   ALGOLIA_ADMIN_KEY — Algolia admin API key (kept in GitHub secrets)
 *   PAGE_PATH         — e.g. /recipies/crown-of-pork-ribs.md (DA.live includes .md)
 *   EVENT_TYPE        — resource-published | resource-unpublished
 *   GITHUB_REF_NAME   — branch name, used to pick dev vs prod index
 */

import algoliasearch from 'algoliasearch';

const {
  ALGOLIA_APP_ID,
  ALGOLIA_ADMIN_KEY,
  PAGE_PATH,
  EVENT_TYPE,
  GITHUB_REF_NAME,
} = process.env;

const IS_PROD = GITHUB_REF_NAME === 'main';
const INDEX_NAME = IS_PROD
  ? 'witchertavern_recipes_prod'
  : 'witchertavern_recipes_dev';

const AEM_ORIGIN = 'https://main--witchertavern--mathlov3.aem.live';

const META_FIELDS = [
  'title',
  'description',
  'category',
  'world',
  'difficulty',
  'cook-time',
  'servings',
  'template',
];

/** DA.live sends paths with .md extension — strip it for the live URL */
function normalizePath(path) {
  return path.replace(/\.md$/, '');
}

/**
 * Extract a meta tag value from raw HTML.
 * Handles both attribute orders: name/property before or after content.
 */
function extractMeta(html, key) {
  const a = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`, 'i');
  return (html.match(a) || html.match(b))?.[1] ?? null;
}

async function fetchRecord(path) {
  const url = `${AEM_ORIGIN}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();

  const record = { path };

  META_FIELDS.forEach((field) => {
    const value = extractMeta(html, field);
    if (value) record[field] = value;
  });

  const ogImage = extractMeta(html, 'og:image');
  if (ogImage) {
    try { record.image = new URL(ogImage).pathname; } catch { record.image = ogImage; }
  }

  return record;
}

async function run() {
  if (!PAGE_PATH) throw new Error('PAGE_PATH env var is missing');

  const path = normalizePath(PAGE_PATH);
  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  const index = client.initIndex(INDEX_NAME);

  if (EVENT_TYPE === 'resource-unpublished') {
    await index.deleteObject(path);
    console.log(`Deleted: ${path} from ${INDEX_NAME}`);
    return;
  }

  const record = await fetchRecord(path);

  if (record.template !== 'recipie') {
    console.log(`Skipping non-recipe page: ${path} (template: ${record.template ?? 'none'})`);
    return;
  }

  await index.saveObject({ ...record, objectID: path });
  console.log(`Indexed: ${path} → ${INDEX_NAME}`);
  console.log(record);
}

run().catch((err) => {
  console.error('[algolia-index]', err.message);
  process.exit(1);
});

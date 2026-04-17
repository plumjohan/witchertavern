/**
 * Injects CollectionPage JSON-LD structured data into recipe collection pages.
 *
 * Collection page URLs:
 *   /recipes/{category}        → fetches /recipes/query-index.json
 *   /en/recipes/{category}     → fetches /en/recipes/query-index.json
 *
 * The category URL slug is an exact match to the `category` field in query-index records.
 */

// Returns { locale: '' | '/en', category: 'sidedishes' } or null if not a collection page.
export function parseCollectionUrl(pathname) {
  const m = pathname.match(/^(\/en)?\/recipes\/([^/]+)\/?$/);
  if (!m) return null;
  return { locale: m[1] ?? '', category: m[2] };
}

async function fetchQueryIndex(locale, env) {
  const aemHost = `main--${env.AEM_SITE}--${env.AEM_ORG}.aem.live`;
  const url = `https://${aemHost}${locale}/recipes/query-index.json`;
  const resp = await fetch(url, { cf: { cacheEverything: true } });
  if (!resp.ok) return [];
  const json = await resp.json();
  return json.data ?? [];
}

function filterRecipes(records, category) {
  return records
    .filter((r) => r.template === 'recipe' && r.category === category)
    .sort((a, b) => (Number(b.lastModified) || 0) - (Number(a.lastModified) || 0));
}

// Extract og:title / og:description from raw HTML using regex (no DOM in Workers).
function extractMeta(html) {
  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
    ?? '';
  const description = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1]
    ?? '';
  return { title, description };
}

function buildCollectionSchema(pathname, meta, recipes, prodHostname) {
  const base = `https://${prodHostname}`;

  const itemListElement = recipes.map((r, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${base}${r.path}`,
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    ...(meta.title && { name: meta.title }),
    ...(meta.description && { description: meta.description }),
    url: `${base}${pathname}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement,
    },
  };

  return JSON.stringify(schema);
}

function injectSchema(html, schema) {
  const tag = `<script type="application/ld+json">${schema}</script>`;
  return html.replace('</head>', `${tag}</head>`);
}

export async function injectCollectionSchema(resp, parsed, pathname, env) {
  const { locale, category } = parsed;
  const prodHostname = env.PROD_HOSTNAME ?? 'witcherinn.com';

  const [html, records] = await Promise.all([
    resp.text(),
    fetchQueryIndex(locale, env),
  ]);

  const recipes = filterRecipes(records, category);
  if (!recipes.length) return new Response(html, resp);

  const meta = extractMeta(html);
  const schema = buildCollectionSchema(pathname, meta, recipes, prodHostname);

  const modified = injectSchema(html, schema);

  const headers = new Headers(resp.headers);
  // Ensure content-length is not stale after injection
  headers.delete('content-length');

  return new Response(modified, { status: resp.status, headers });
}

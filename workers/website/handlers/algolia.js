const META_FIELDS = [
  'description',
  'category',
  'world',
  'difficulty',
  'cook-time',
  'servings',
  'template',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function normalizePath(path) {
  return path.replace(/\.md$/, '');
}

function extractTitle(html) {
  return html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ?? null;
}

function extractMeta(html, key) {
  const a = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`, 'i');
  return (html.match(a) || html.match(b))?.[1] ?? null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default async function handleAlgoliaIndex(req, env) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { path: rawPath } = body;
  if (!rawPath) return json({ error: 'Missing path' }, 400);

  const path = normalizePath(rawPath);
  const previewOrigin = `https://main--${env.AEM_SITE}--${env.AEM_ORG}.aem.page`;

  const pageRes = await fetch(`${previewOrigin}${path}`);
  if (!pageRes.ok) return json({ error: `Failed to fetch page: ${pageRes.status}` }, 502);

  const html = await pageRes.text();
  const record = { path };

  const lastModified = pageRes.headers.get('last-modified');
  if (lastModified) record.lastModified = Math.floor(new Date(lastModified).getTime() / 1000);

  const title = extractTitle(html);
  if (title) record.title = title;

  META_FIELDS.forEach((field) => {
    const value = extractMeta(html, field);
    if (value) record[field] = value;
  });

  const ogImage = extractMeta(html, 'og:image');
  if (ogImage) {
    const decoded = ogImage.replace(/&amp;/g, '&');
    record.image = decoded.startsWith('http') ? decoded : `${previewOrigin}${decoded}`;
  }

  if (record.template !== 'recipe') {
    return json({ skipped: true, reason: `non-recipe template: ${record.template ?? 'none'}` });
  }

  const indexName = env.ALGOLIA_INDEX_NAME;
  const objectID = encodeURIComponent(path);

  const algoliaRes = await fetch(
    `https://${env.ALGOLIA_APP_ID}.algolia.net/1/indexes/${indexName}/${objectID}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': env.ALGOLIA_APP_ID,
        'X-Algolia-API-Key': env.ALGOLIA_ADMIN_KEY,
      },
      body: JSON.stringify({ ...record, objectID: path }),
    },
  );

  if (!algoliaRes.ok) {
    const error = await algoliaRes.text();
    return json({ error: `Algolia error: ${error}` }, 502);
  }

  return json({ indexed: path, index: indexName });
}

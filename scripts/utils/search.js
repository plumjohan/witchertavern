/**
 * Search utilities
 *
 * Shared logic for search inputs across the site.
 * Used by: search-input block, recipe-search block, header.
 */

/**
 * Custom event name dispatched by search-input (and header search in future).
 * recipe-search listens for this and calls e.preventDefault() to claim it.
 * If unclaimed, search-input falls back to full-page navigation.
 */
export const SEARCH_QUERY_EVENT = 'search:query';

/**
 * Returns the current ?q= value from the URL, or empty string.
 * @returns {string}
 */
export function getSearchQuery() {
  return new URLSearchParams(window.location.search).get('q') ?? '';
}

/**
 * Builds a URL for the given search page with ?q= applied.
 * Preserves any existing params on baseUrl.
 *
 * @param {string} baseUrl - The search page path (e.g. '/recipes')
 * @param {string} query
 * @returns {string}
 */
export function buildSearchUrl(baseUrl, query) {
  const url = new URL(baseUrl, window.location.origin);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  return url.toString();
}

/**
 * Navigates to the search page with the given query.
 * Full page navigation — recipe-search will read ?q= on arrival.
 *
 * @param {string} baseUrl - The search page path (e.g. '/recipes')
 * @param {string} query
 */
export function navigateToSearch(baseUrl, query) {
  window.location.assign(buildSearchUrl(baseUrl, query));
}

// ── Suggestion providers (header autocomplete) ────────────────────────────────

/**
 * Algolia suggestion provider for header autocomplete.
 * Returns an async function (query) => hit[] where each hit has {path, title, category, image}.
 *
 * @param {string} appId
 * @param {string} searchKey
 * @param {string} indexName
 * @param {number} [maxResults=6]
 * @returns {(query: string) => Promise<object[]>}
 */
export function createAlgoliaSuggestProvider(appId, searchKey, indexName, maxResults = 6) {
  return async (query) => {
    try {
      const res = await fetch(
        `https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`,
        {
          method: 'POST',
          headers: {
            'X-Algolia-Application-Id': appId,
            'X-Algolia-API-Key': searchKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            hitsPerPage: maxResults,
            attributesToRetrieve: ['path', 'title', 'category', 'image'],
          }),
        },
      );
      if (!res.ok) return [];
      return (await res.json()).hits ?? [];
    } catch { return []; }
  };
}

/**
 * Query-index suggestion provider for header autocomplete.
 * Fetches and caches the full index once, then filters client-side by title.
 * Returns an async function (query) => hit[] where each hit has {path, title, category, image}.
 *
 * @param {string} url
 * @param {number} [maxResults=6]
 * @returns {(query: string) => Promise<object[]>}
 */
export function createQueryIndexSuggestProvider(url, maxResults = 6) {
  let cache = null;
  return async (query) => {
    if (!cache) {
      try {
        const resp = await fetch(url);
        cache = resp.ok ? ((await resp.json()).data ?? []) : [];
      } catch { cache = []; }
    }
    const q = query.toLowerCase();
    return cache
      .filter((item) => item.title?.toLowerCase().includes(q))
      .slice(0, maxResults);
  };
}

// ── Full search providers (recipe-search block) ───────────────────────────────

/**
 * Algolia full-search provider for recipe-search.
 *
 * init()  — unfiltered fetch with facets=true → { hits, facetValues }
 * query() — filtered fetch → { hits }
 *
 * @param {{ appId: string, searchKey: string, indexName: string }} cfg
 */
export function createAlgoliaSearchProvider({ appId, searchKey, indexName }) {
  async function fetch$(query, facetFilters, fetchFacets = false) {
    const body = {
      query,
      facetFilters,
      attributesToRetrieve: ['path', 'title', 'description', 'category', 'image', 'difficulty', 'cook-time', 'servings', 'world'],
      hitsPerPage: 500,
    };
    if (fetchFacets) body.facets = ['category', 'difficulty', 'world'];

    const res = await fetch(
      `https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`,
      {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': appId,
          'X-Algolia-API-Key': searchKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`Algolia error: ${res.status}`);
    const json = await res.json();
    return { hits: json.hits ?? [], facets: json.facets ?? {} };
  }

  function buildFilters(fs) {
    const groups = [];
    if (fs.category.size) groups.push([...fs.category].map((v) => `category:${v}`));
    if (fs.difficulty.size) groups.push([...fs.difficulty].map((v) => `difficulty:${v}`));
    if (fs.world.size) groups.push([...fs.world].map((v) => `world:${v}`));
    return groups;
  }

  function toFacetValues(facets) {
    const sortKeys = (obj) => Object.keys(obj ?? {}).sort();
    return {
      category: sortKeys(facets.category),
      difficulty: sortKeys(facets.difficulty),
      world: sortKeys(facets.world),
    };
  }

  return {
    async init() {
      const { hits, facets } = await fetch$('', [], true);
      return { hits, facetValues: toFacetValues(facets) };
    },
    async query(query, filterState) {
      const { hits } = await fetch$(query, buildFilters(filterState));
      return { hits };
    },
  };
}

/**
 * Query-index full-search provider for recipe-search.
 *
 * Fetches all records once on init, then filters entirely client-side.
 * Facet values are derived from the full dataset.
 *
 * init()  → { hits, facetValues }
 * query() → { hits }
 *
 * Expected JSON shape: { data: [ { path, title, description, category,
 *   image, difficulty, cook-time, servings, world }, … ] }
 *
 * @param {string} url
 */
export function createQueryIndexSearchProvider(url) {
  let allHits = [];

  function deriveValues(hits) {
    const sets = { category: new Set(), difficulty: new Set(), world: new Set() };
    hits.forEach((h) => {
      if (h.category) sets.category.add(h.category);
      if (h.difficulty) sets.difficulty.add(h.difficulty);
      if (h.world) sets.world.add(h.world);
    });
    return {
      category: [...sets.category].sort(),
      difficulty: [...sets.difficulty].sort(),
      world: [...sets.world].sort(),
    };
  }

  function filterHits(hits, query, fs) {
    const q = query.toLowerCase();
    return hits.filter((h) => {
      if (q && !`${h.title ?? ''} ${h.description ?? ''}`.toLowerCase().includes(q)) return false;
      if (fs.category.size && !fs.category.has(h.category)) return false;
      if (fs.difficulty.size && !fs.difficulty.has(h.difficulty)) return false;
      if (fs.world.size && !fs.world.has(h.world)) return false;
      return true;
    });
  }

  return {
    async init() {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`query-index fetch error: ${res.status}`);
      const json = await res.json();
      allHits = (json.data ?? []).map((row) => ({
        path: row.path,
        title: row.title,
        description: row.description,
        category: row.category,
        image: row.image,
        difficulty: row.difficulty,
        'cook-time': row['cook-time'] ?? row.cookTime,
        servings: row.servings,
        world: row.world,
      }));
      return { hits: allHits, facetValues: deriveValues(allHits) };
    },
    async query(query, filterState) {
      return { hits: filterHits(allHits, query, filterState) };
    },
  };
}

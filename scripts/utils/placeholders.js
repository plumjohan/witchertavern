import { getConfig } from '../ak.js';

const cache = {};

/**
 * Fetches and caches placeholders for the current locale.
 * Returns a plain { key: value } map.
 * @returns {Promise<Object>}
 */
export default async function getPlaceholders() {
  const { locale } = getConfig();
  const prefix = locale?.prefix ?? '';

  if (cache[prefix]) return cache[prefix];

  try {
    const resp = await fetch(`${prefix}/placeholders.json`);
    if (!resp.ok) throw new Error(resp.status);
    const json = await resp.json();
    cache[prefix] = Object.fromEntries(
      (json.data ?? []).map(({ key, value }) => [key, value]),
    );
  } catch {
    cache[prefix] = {};
  }

  return cache[prefix];
}

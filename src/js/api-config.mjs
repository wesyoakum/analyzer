// ===== api-config.mjs — centralized API URL and auth header helpers =====
//
// When running locally (Express dev server), uses relative /api/ paths.
// When deployed to GitHub Pages, calls the Cloudflare Worker with a bearer token.

const isLocal =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

// ----- Configuration -----
// Update WORKER_URL after deploying your Cloudflare Worker.
// Update API_TOKEN to match the secret set via: npx wrangler secret put API_TOKEN
const WORKER_URL = 'https://analyzer-api.wesyoakum.workers.dev';
const API_TOKEN = 'Apple123!';

const API_BASE_URL = isLocal ? '' : WORKER_URL;

/**
 * Build a full API URL for the given path.
 * @param {string} path  e.g. '/api/presets' or '/api/projects/abc-123'
 * @returns {string}
 */
export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

/**
 * Build fetch headers with auth (when deployed) merged with any extras.
 * @param {Record<string,string>} [extra]
 * @returns {Record<string,string>}
 */
export function apiHeaders(extra = {}) {
  if (isLocal) return { ...extra };
  return {
    Authorization: `Bearer ${API_TOKEN}`,
    ...extra,
  };
}

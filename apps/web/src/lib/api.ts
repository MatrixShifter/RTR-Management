const envApiUrl = (import.meta.env.VITE_API_URL || '').trim();

/**
 * Standard API Client Configuration for RTR Wholesale Management.
 * Resolves to relative '/api' in production (routed by Vercel services rewrite to the api service)
 * and proxies through Vite dev server to localhost:4000 in local development.
 * Strictly guarantees no localhost URL leaks into production builds.
 */
export const API_BASE_URL: string = 
  (import.meta.env.PROD && envApiUrl.includes('localhost')) || !envApiUrl
    ? '/api'
    : envApiUrl;

export async function fetchApiHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

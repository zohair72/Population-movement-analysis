const browserDefaultApiBase =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:5000'
    : '';

const rawApiBase = process.env.REACT_APP_API_BASE_URL || browserDefaultApiBase;

export const API_BASE_URL = rawApiBase.endsWith('/')
  ? rawApiBase.slice(0, -1)
  : rawApiBase;

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function fetchJson(path, init) {
  const response = await fetch(apiUrl(path), init);
  const rawText = await response.text();

  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    throw new Error(`API returned non-JSON content for ${path}.`);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed for ${path}.`);
  }

  return data;
}

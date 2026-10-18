const rawApi = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3001';
const formattedApi = rawApi.startsWith('http://') || rawApi.startsWith('https://') || rawApi.startsWith('/') ? rawApi : `https://${rawApi}`;
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_URL =
  isLocalhost || rawApi === 'http://localhost:3001' || rawApi === 'http://localhost:3001/' || rawApi === ''
    ? '' // use relative — proxy handles it
    : formattedApi.replace(/\/+$/, '');

export const DEFAULT_AUTH_TOKEN = 'medikiosk-demo-token';

export function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_AUTH_TOKEN;
  }

  const stored =
    localStorage.getItem('doctor_token') ||
    sessionStorage.getItem('doctor_token') ||
    localStorage.getItem('triage_token') ||
    sessionStorage.getItem('token') ||
    DEFAULT_AUTH_TOKEN;

  // Validate JWT expiration if formatted as JWT
  if (stored && stored.includes('.')) {
    try {
      const parts = stored.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return DEFAULT_AUTH_TOKEN;
        }
      }
    } catch {
      return DEFAULT_AUTH_TOKEN;
    }
  }

  return stored || DEFAULT_AUTH_TOKEN;
}

export function getAuthHeaders(customHeaders: HeadersInit = {}): Headers {
  const headers = new Headers(customHeaders);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${getAuthToken()}`);
  }
  return headers;
}

export async function authFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const headers = getAuthHeaders(init?.headers);
  return fetch(url, { ...init, headers });
}

// Transparent fetch wrapper for browser environment:
// Automatically attaches Bearer token to backend API requests if not already set
if (typeof window !== 'undefined' && !(window as any).__api_fetch_intercepted__) {
  (window as any).__api_fetch_intercepted__ = true;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url || '');
      const isBackend =
        (Boolean(API_URL) && url.startsWith(API_URL)) ||
        url.startsWith('/api') ||
        url.includes('/api/') ||
        url.startsWith('/auth') ||
        url.startsWith('/ayush-assessment') ||
        url.startsWith('/medical-history') ||
        url.startsWith('/history-facts') ||
        url.startsWith('/answers') ||
        url.startsWith('/sessions') ||
        url.startsWith('/documents') ||
        url.startsWith('/summary');
      if (isBackend) {
        const headers = new Headers(init?.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${getAuthToken()}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // Fall through to original fetch on any URL parse issue
    }
    return originalFetch(input, init);
  };
}

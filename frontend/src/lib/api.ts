function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://medikisoki-sih-backend.onrender.com';
    }
  }
  return 'http://localhost:3001';
}

export const API_URL = resolveApiUrl();
export const DEFAULT_AUTH_TOKEN = 'medikiosk-demo-token';

export function getAuthToken(): string {
  return localStorage.getItem('doctor_token') || DEFAULT_AUTH_TOKEN;
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
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(API_URL) || url.startsWith('/api/') || url.includes('/api/')) {
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

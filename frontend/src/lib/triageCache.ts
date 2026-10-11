const cache = new Map<string, { data: any, timestamp: number }>();
const TTL = 60 * 1000;

export async function prefetchTriage(id: string, token: string | null) {
  if (cache.has(id)) {
    const cached = cache.get(id);
    if (cached && Date.now() - cached.timestamp < TTL) {
      return; // Already cached and fresh
    }
  }

  try {
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`/api/sessions/${id}/triage`, { headers });
    if (res.ok) {
      const data = await res.json();
      cache.set(id, { data, timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('Failed to prefetch triage summary:', err);
  }
}

export function getCachedTriage(id: string) {
  if (cache.has(id)) {
    const cached = cache.get(id);
    if (cached && Date.now() - cached.timestamp < TTL) {
      return cached.data;
    }
    cache.delete(id);
  }
  return null;
}

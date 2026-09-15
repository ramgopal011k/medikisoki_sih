import crypto from 'crypto';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 3600 * 1000; // 1 hour TTL
const MAX_CACHE_SIZE = 500;

// LRU In-memory query and response cache
const genericCache = new Map<string, CacheEntry<any>>();

function normalizeKey(key: string): string {
  if (key.startsWith('ayush:') || key.startsWith('query:')) {
    return key;
  }
  return crypto.createHash('sha256').update(key.trim().toLowerCase()).digest('hex');
}

export function getCached<T = any>(key: string): T | null {
  const normKey = normalizeKey(key);
  const entry = genericCache.get(normKey);

  if (!entry) return null;

  // Check TTL expiration
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    genericCache.delete(normKey);
    return null;
  }

  // Refresh LRU order (delete and re-insert)
  genericCache.delete(normKey);
  genericCache.set(normKey, entry);

  return entry.data as T;
}

export function setCached<T = any>(key: string, data: T): void {
  const normKey = normalizeKey(key);

  // Evict oldest entry if at capacity
  if (genericCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = genericCache.keys().next().value;
    if (oldestKey) {
      genericCache.delete(oldestKey);
    }
  }

  genericCache.set(normKey, {
    data,
    timestamp: Date.now(),
  });
}

export function clearCache(): void {
  genericCache.clear();
}

export function getCacheSize(): number {
  return genericCache.size;
}

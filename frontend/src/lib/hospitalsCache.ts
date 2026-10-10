import { API_URL } from './api';

export const HOSPITALS_CACHE_KEY = 'medikiosk.hospitals.cache';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface HospitalsCachePayload {
  data: any[];
  timestamp: number;
}

/**
 * Retrieve cached hospitals from localStorage.
 */
export function getCachedHospitals(): HospitalsCachePayload | null {
  try {
    const raw = localStorage.getItem(HOSPITALS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HospitalsCachePayload;
    if (parsed && Array.isArray(parsed.data) && typeof parsed.timestamp === 'number') {
      return parsed;
    }
  } catch (e) {
    console.warn('[HospitalsCache] Failed to parse cache:', e);
  }
  return null;
}

/**
 * Save hospitals to localStorage with current timestamp.
 */
export function setCachedHospitals(data: any[]): void {
  try {
    const entry: HospitalsCachePayload = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(HOSPITALS_CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    console.warn('[HospitalsCache] Failed to save cache:', e);
  }
}

/**
 * Remove a specific hospital from localStorage cache.
 */
export function removeCachedHospital(id: string): void {
  try {
    const cached = getCachedHospitals();
    if (cached && Array.isArray(cached.data)) {
      const updated = cached.data.filter((h: any) => h.id !== id && h.hospital_id !== id);
      setCachedHospitals(updated);
    }
  } catch (e) {
    console.warn('[HospitalsCache] Failed to remove hospital from cache:', e);
  }
}

/**
 * Clear the hospitals cache entirely.
 */
export function clearHospitalsCache(): void {
  try {
    localStorage.removeItem(HOSPITALS_CACHE_KEY);
  } catch (e) {
    console.warn('[HospitalsCache] Failed to clear hospitals cache:', e);
  }
}

/**
 * Stale-While-Revalidate loader:
 * - If <5 min old and !forceFresh: immediately invoke onData with cached data, revalidate in background.
 * - Otherwise / fresh fetch: fetch from API, render immediately, and update cache.
 */
export async function loadHospitalsSWR(
  onData: (hospitals: any[], fromCache: boolean) => void,
  forceFresh = false
): Promise<any[]> {
  const cached = getCachedHospitals();
  let hasRenderedCache = false;

  if (!forceFresh && cached && (Date.now() - cached.timestamp < FIVE_MINUTES_MS)) {
    onData(cached.data, true);
    hasRenderedCache = true;
  }

  try {
    const res = await fetch(`${API_URL}/api/hospitals`);
    const json = await res.json();
    const freshData = json.data || [];
    if (Array.isArray(freshData)) {
      setCachedHospitals(freshData);
      onData(freshData, false);
      return freshData;
    }
  } catch (err) {
    if (!hasRenderedCache && cached) {
      onData(cached.data, true);
      return cached.data;
    }
    console.error('[HospitalsCache] Failed to fetch fresh hospitals:', err);
  }

  return cached?.data || [];
}


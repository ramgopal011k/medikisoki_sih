import { API_URL } from './api';
import { loadHospitalsSWR } from './hospitalsCache';

const SESSIONS_CACHE_PREFIX = 'medikiosk.sessions.cache.';
const VISITS_CACHE_PREFIX = 'medikiosk.visits.cache.';

/**
 * Prefetch registered hospitals list on hover (e.g. /admin/hospitals link)
 */
export function prefetchHospitals(): void {
  try {
    loadHospitalsSWR(() => {}).catch(() => {});
  } catch (e) {
    console.warn('[Prefetch] Hospitals prefetch notice:', e);
  }
}

/**
 * Prefetch doctor triage queue sessions post-login
 */
export async function prefetchDoctorSessions(hospitalId: string = 'all'): Promise<any[]> {
  try {
    const url = hospitalId === 'all' 
      ? `${API_URL}/api/sessions` 
      : `${API_URL}/api/sessions?hospital_id=${hospitalId}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('doctor_token') || 'mock-doctor-token' : 'mock-doctor-token';
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.data) {
      sessionStorage.setItem(`${SESSIONS_CACHE_PREFIX}${hospitalId}`, JSON.stringify({
        data: json.data,
        timestamp: Date.now()
      }));
      return json.data;
    }
  } catch (e) {
    console.warn('[Prefetch] Doctor sessions prefetch notice:', e);
  }
  return [];
}

/**
 * Prefetch patient records/visits post-login
 */
export async function prefetchPatientVisits(abhaId: string): Promise<any[]> {
  if (!abhaId) return [];
  try {
    const res = await fetch(`${API_URL}/api/patient/visits/${abhaId}`);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.data) {
      sessionStorage.setItem(`${VISITS_CACHE_PREFIX}${abhaId}`, JSON.stringify({
        data: json.data,
        timestamp: Date.now()
      }));
      return json.data;
    }
  } catch (e) {
    console.warn('[Prefetch] Patient visits prefetch notice:', e);
  }
  return [];
}

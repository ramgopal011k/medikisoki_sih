import dotenv from 'dotenv';
import cron from 'node-cron';
import { app } from './app';
import { supabase } from './supabase';
import { prewarmRag } from './rag/prewarm';
import { preseedCommonAssessments } from './rag/preseed';

import { preseedMedGemma } from './orchestration/preseed-medgemma';

dotenv.config();

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED]', err);
  // Do NOT exit
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err);
  // Do NOT exit — log and continue
});

export async function cleanupStaleSessions(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error, count } = await supabase
      .from('sessions')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
      .eq('doctor_verified', false)
      .select('id');

    if (error) {
      console.error('[TTL Cleanup] Failed to cleanup unverified sessions:', error);
      return 0;
    }
    const deletedCount = count ?? (data?.length || 0);
    console.log(`[TTL Cleanup] Defensive TTL cleaned up ${deletedCount} unverified session(s) older than 24h.`);
    return deletedCount;
  } catch (err: any) {
    console.error('[TTL Cleanup] Exception during defensive TTL cleanup:', err);
    return 0;
  }
}

// Defensive TTL: run every 6 hours via node-cron
cron.schedule('0 */6 * * *', async () => {
  console.log('[TTL Cleanup] Triggering 6-hour defensive session TTL cleanup...');
  await cleanupStaleSessions();
});

// Periodic timer fallback every 6 hours
setInterval(() => {
  void cleanupStaleSessions();
}, 6 * 60 * 60 * 1000);

const port = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Backend server running on port ${port} (all interfaces)`);

    // FIX 7: Startup reachability check (1000ms delay, non-blocking)
    const reachabilityTimer = setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const models = (data.models || []).map((m: any) => m.name);
          const hasMedGemma = models.some((m: string) => m.includes('medgemma'));
          console.log(`[OLLAMA] ✓ REACHABLE — models: ${models.join(', ')}`);
          console.log(`[OLLAMA]   medgemma present: ${hasMedGemma ? 'yes' : 'NO'}`);
        } else {
          console.warn(`[OLLAMA] ✗ /api/tags returned ${res.status}`);
        }
      } catch (err: any) {
        console.warn(`[OLLAMA] ✗ UNREACHABLE — ${err?.message || err}`);
        console.warn(`[OLLAMA]   Running in Gemini-fallback mode`);
      }
    }, 1000);
    reachabilityTimer.unref();

    // FIX 4: Backend warmup on boot (3000ms delay, non-blocking)
    const warmupTimer = setTimeout(async () => {
      try {
        const t0 = Date.now();
        await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'medgemma1.5:latest',
            messages: [{ role: 'user', content: 'ping' }],
            stream: false,
            keep_alive: '30m',
            options: { num_predict: 1 }
          }),
          signal: AbortSignal.timeout(45000)
        });
        console.log(`[OLLAMA] ✓ WARMED in ${Date.now() - t0}ms`);
      } catch (err: any) {
        console.warn(`[OLLAMA] warmup failed: ${err?.message || err}`);
      }
    }, 3000);
    warmupTimer.unref();

    // FIX 6: Background heartbeat (10-minute interval, non-blocking)
    const heartbeatTimer = setInterval(async () => {
      try {
        const t0 = Date.now();
        await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'medgemma1.5:latest',
            messages: [{ role: 'user', content: 'ping' }],
            stream: false,
            keep_alive: '30m',
            options: { num_predict: 1 }
          }),
          signal: AbortSignal.timeout(45000)
        });
        console.log(`[OLLAMA] ♥ HEARTBEAT ok in ${Date.now() - t0}ms`);
      } catch (err: any) {
        console.warn(`[OLLAMA] ♥ HEARTBEAT failed: ${err?.message || err}`);
      }
    }, 10 * 60 * 1000);
    heartbeatTimer.unref();

    setTimeout(async () => {
      const t0 = Date.now();
      await supabase.from('hospitals').select('id').limit(1);
      console.log(`[warmup] supabase in ${Date.now() - t0}ms`);
    }, 2000);

    setInterval(() => {
      supabase.from('hospitals').select('id').limit(1).then(() => {});
    }, 4 * 60 * 1000);

    cleanupStaleSessions().catch((err) => console.warn('[TTL Cleanup] Boot cleanup notice:', err));
    prewarmRag().catch((err) => console.warn('[RAG] Prewarm notice:', err.message));
    preseedCommonAssessments().catch((err) => console.warn('[preseed] Notice:', err.message));
    const medgemmaTimeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('MedGemma preseed 45s timeout')), 45000));
    Promise.race([preseedMedGemma(), medgemmaTimeout])
      .catch((err) => console.warn('[medgemma-preseed] Notice:', err?.message || err));
  });
}

export default app;

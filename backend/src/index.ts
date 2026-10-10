import dotenv from 'dotenv';
import cron from 'node-cron';
import { app } from './app';
import { supabase } from './supabase';
import { ensureOllamaRunning } from './services/ollamaBootstrap';
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
  void (async () => {
    await ensureOllamaRunning().catch((err) => console.warn('[ollama] Notice:', err?.message || err));
    app.listen(Number(port), '0.0.0.0', () => {
      console.log(`Backend server running on port ${port} (all interfaces)`);
      cleanupStaleSessions().catch((err) => console.warn('[TTL Cleanup] Boot cleanup notice:', err));
      prewarmRag().catch((err) => console.warn('[RAG] Prewarm notice:', err.message));
      preseedCommonAssessments().catch((err) => console.warn('[preseed] Notice:', err.message));
      const medgemmaTimeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('MedGemma preseed 45s timeout')), 45000));
      Promise.race([preseedMedGemma(), medgemmaTimeout])
        .catch((err) => console.warn('[medgemma-preseed] Notice:', err?.message || err));
    });
  })();
}

export default app;

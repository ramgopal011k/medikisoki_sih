import dotenv from 'dotenv';
import cron from 'node-cron';
import { app } from './app';
import { supabase } from './supabase';
import { ensureOllamaRunning } from './services/ollamaBootstrap';
import { prewarmRag } from './rag/prewarm';
import { preseedCommonAssessments } from './rag/preseed';

dotenv.config();

cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running DPDPA stale session purge...');
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const { error } = await supabase
      .from('sessions')
      .delete()
      .lt('created_at', yesterday.toISOString());
    if (error) console.error('[CRON] Failed to purge sessions:', error);
    else console.log('[CRON] Successfully purged stale sessions.');
  } catch (err) {
    console.error('[CRON] Exception during session purge:', err);
  }
});

const port = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  void (async () => {
    await ensureOllamaRunning().catch((err) => console.warn('[ollama] Notice:', err?.message || err));
    app.listen(Number(port), '0.0.0.0', () => {
      console.log(`Backend server running on port ${port} (all interfaces)`);
      prewarmRag().catch((err) => console.warn('[RAG] Prewarm notice:', err.message));
      preseedCommonAssessments().catch((err) => console.warn('[preseed] Notice:', err.message));
    });
  })();
}

export default app;

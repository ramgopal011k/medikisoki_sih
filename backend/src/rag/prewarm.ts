import { embed } from './embed';
import { supabase } from '../supabase';

export async function prewarmRag(): Promise<void> {
  console.log('[RAG Prewarm] Initiating pre-warming sequence for AYUSH RAG pipeline...');
  const start = Date.now();

  try {
    // 1. Warm Gemini embedding model
    const testEmbedding = await embed('Ayurvedic dosha agni assessment prewarm');
    if (!testEmbedding || testEmbedding.length !== 768) {
      throw new Error(`Embedding pre-warm returned invalid dimensions: ${testEmbedding?.length}`);
    }
    console.log(`[RAG Prewarm] Gemini text-embedding-001 pre-warmed successfully (${testEmbedding.length} dims).`);

    // 2. Verify Supabase pgvector table responsiveness
    const { count, error } = await supabase
      .from('rag_chunks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Supabase rag_chunks table check failed: ${error.message}`);
    }
    console.log(`[RAG Prewarm] Supabase rag_chunks accessible. Total active chunks in index: ${count}`);

    const duration = Date.now() - start;
    console.log(`[RAG Prewarm] Pre-warming completed successfully in ${duration} ms.`);
  } catch (err: any) {
    console.error(`[RAG Prewarm ERROR] Pre-warming sequence encountered error: ${err.message || err}`);
    throw err;
  }
}

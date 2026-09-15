import { embed } from './embed';
import { supabase } from '../supabase';
import { extractDoshaTags } from './chunk';
import { getCached, setCached } from './cache';

export interface RetrievedChunk {
  chunk_id: string;
  text: string;
  source: string;
  section: string;
  chapter: string;
  verse: string | null;
  similarity: number;
  dosha_tags: string[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// In-memory chunk cache to avoid repetitive network overhead
let chunksCache: any[] | null = null;
let lastCacheTime = 0;

async function getAllIndexedChunks(): Promise<any[]> {
  const now = Date.now();
  if (chunksCache && now - lastCacheTime < 300000) {
    return chunksCache;
  }

  const { data, error } = await supabase
    .from('rag_chunks')
    .select('chunk_id, text, source, section, chapter, verse, language, dosha_tags, embedding');

  if (error || !data || data.length === 0) {
    throw new Error(`Failed to retrieve context from Supabase: ${error?.message || 'Empty dataset'}`);
  }

  chunksCache = data;
  lastCacheTime = now;
  return chunksCache;
}

export async function retrieveAyushContext(
  query: string,
  topK: number = 5,
  explicitDoshaFilter?: string[]
): Promise<RetrievedChunk[]> {
  // 1. Check in-memory query cache first
  const cached = getCached(query);
  if (cached && cached.length >= topK) {
    return cached.slice(0, topK);
  }

  const queryEmbedding = await embed(query);

  const queryDoshaTags =
    explicitDoshaFilter && explicitDoshaFilter.length > 0
      ? explicitDoshaFilter
      : extractDoshaTags(query);

  const allChunks = await getAllIndexedChunks();
  const scored: RetrievedChunk[] = [];

  for (const c of allChunks) {
    const emb = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding;
    const baseSim = Array.isArray(emb) ? cosineSimilarity(queryEmbedding, emb) : 0;
    const tags: string[] = c.dosha_tags || [];

    // Classical source authority weight
    let sourceWeight = 1.0;
    const sLower = (c.source || '').toLowerCase();
    if (sLower.includes('charaka')) sourceWeight = 1.15;
    else if (sLower.includes('sushruta')) sourceWeight = 1.15;
    else if (sLower.includes('rasa jala nidhi')) sourceWeight = 1.10;
    else if (sLower.includes('veda')) sourceWeight = 1.05;
    else sourceWeight = 0.90;

    // Dosha alignment weight
    let doshaWeight = 1.0;
    if (queryDoshaTags.length > 0) {
      const hasMatchingDosha = queryDoshaTags.some((t) => tags.includes(t));
      if (hasMatchingDosha) {
        doshaWeight = 1.12;
      } else {
        doshaWeight = 0.92;
      }
    }

    const finalSim = Math.min(0.99, baseSim * sourceWeight * doshaWeight);

    scored.push({
      chunk_id: c.chunk_id,
      text: c.text,
      source: c.source,
      section: c.section || 'General',
      chapter: c.chapter || 'General',
      verse: c.verse || null,
      dosha_tags: tags,
      similarity: Number(finalSim.toFixed(4)),
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  setCached(query, scored);
  return scored.slice(0, topK);
}

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Chunk } from './chunk';
import { embedBatch } from './embed';
import { supabase } from '../supabase';

export async function indexFullCorpus() {
  const chunksPath = path.resolve(__dirname, '../../../rag_corpus/chunks/full_chunks.jsonl');
  const cachePath = path.resolve(__dirname, '../../../rag_corpus/embeddings/full_embeddings.json');

  if (!fs.existsSync(chunksPath)) {
    throw new Error(`Chunks file not found at: ${chunksPath}`);
  }

  // Load existing cache if any
  let cache: Record<string, number[]> = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`Loaded ${Object.keys(cache).length} pre-cached embeddings from ${cachePath}`);
    } catch (e) {}
  }

  const fileStream = fs.createReadStream(chunksPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const chunks: Chunk[] = [];
  for await (const line of rl) {
    if (line.trim()) {
      try {
        chunks.push(JSON.parse(line));
      } catch (e) {}
    }
  }

  console.log(`Total chunks in full dataset to index: ${chunks.length}`);
  const startTime = Date.now();
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);

    // Check which chunks need embedding
    const toEmbedIndices: number[] = [];
    const embeddings: number[][] = new Array(chunkBatch.length);

    chunkBatch.forEach((c, idx) => {
      if (cache[c.chunk_id] && cache[c.chunk_id].length === 768) {
        embeddings[idx] = cache[c.chunk_id];
      } else {
        toEmbedIndices.push(idx);
      }
    });

    if (toEmbedIndices.length > 0) {
      const textsToEmbed = toEmbedIndices.map((idx) => chunkBatch[idx].text);
      const newEmbeddings = await embedBatch(textsToEmbed, 5, 600);
      toEmbedIndices.forEach((chunkIdx, eIdx) => {
        embeddings[chunkIdx] = newEmbeddings[eIdx];
        cache[chunkBatch[chunkIdx].chunk_id] = newEmbeddings[eIdx];
      });

      // Save cache checkpoint periodically
      if (i % 50 === 0) {
        const embDir = path.dirname(cachePath);
        if (!fs.existsSync(embDir)) fs.mkdirSync(embDir, { recursive: true });
        fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
      }
    }

    const rowsToInsert = chunkBatch.map((c, idx) => ({
      chunk_id: c.chunk_id,
      text: c.text,
      source: c.source,
      section: c.section || null,
      chapter: c.chapter || null,
      verse: c.verse || null,
      language: c.language || 'en',
      dosha_tags: c.dosha_tags || [],
      token_count: c.token_count,
      char_count: c.char_count,
      embedding: embeddings[idx],
    }));

    const { error } = await supabase
      .from('rag_chunks')
      .upsert(rowsToInsert, { onConflict: 'chunk_id' });

    if (error) {
      console.error(`Error inserting batch at index ${i}:`, error);
      throw error;
    }

    inserted += chunkBatch.length;
    if (inserted % 100 === 0 || inserted === chunks.length) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Progress: Indexed ${inserted}/${chunks.length} chunks (${elapsedSec}s elapsed)`);
    }
  }

  // Final cache save
  const embDir = path.dirname(cachePath);
  if (!fs.existsSync(embDir)) fs.mkdirSync(embDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');

  const totalTimeMin = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\nFull scaling complete: ${inserted} chunks indexed in ${totalTimeMin} minutes.`);

  const { count } = await supabase.from('rag_chunks').select('*', { count: 'exact', head: true });
  console.log(`Total rows in Supabase rag_chunks: ${count}`);

  return { inserted, totalTimeMin, totalRowCount: count };
}

if (require.main === module) {
  indexFullCorpus()
    .then((res) => {
      console.log('Finished successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Indexing failed:', err);
      process.exit(1);
    });
}

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { supabase } from '../supabase';
import { embedBatch } from './embed';
import { Chunk } from './chunk';

export async function indexChunks(
  chunksPath: string = path.resolve(__dirname, '../../../rag_corpus/chunks/mini_chunks.jsonl'),
  batchSize: number = 20
) {
  if (!fs.existsSync(chunksPath)) {
    throw new Error(`Chunks file not found at: ${chunksPath}`);
  }

  console.log(`Loading chunks from: ${chunksPath}`);
  const fileStream = fs.createReadStream(chunksPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const chunks: Chunk[] = [];
  for await (const line of rl) {
    if (line.trim()) {
      try {
        chunks.push(JSON.parse(line));
      } catch (e) {
        // ignore malformed line
      }
    }
  }

  console.log(`Total chunks to index: ${chunks.length}`);
  const startTime = Date.now();

  let insertedCount = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);
    const texts = chunkBatch.map((c) => c.text);

    console.log(`Embedding batch ${Math.floor(i / batchSize) + 1} (${chunkBatch.length} chunks)...`);
    const embeddings = await embedBatch(texts, batchSize);

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

    const { data, error } = await supabase
      .from('rag_chunks')
      .upsert(rowsToInsert, { onConflict: 'chunk_id' });

    if (error) {
      console.error(`Error inserting batch at index ${i}:`, error);
      throw error;
    }

    insertedCount += chunkBatch.length;
    console.log(`Inserted ${insertedCount}/${chunks.length} chunks into Supabase rag_chunks`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Successfully indexed ${insertedCount} chunks in ${durationSec}s.`);

  // Verify final count
  const { count, error: countErr } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Error verifying row count:', countErr);
  } else {
    console.log(`Total row count in Supabase rag_chunks: ${count}`);
  }

  return {
    insertedCount,
    durationSec,
    totalRowCount: count,
  };
}

if (require.main === module) {
  indexChunks().catch(console.error);
}

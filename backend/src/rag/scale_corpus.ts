import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Chunk, extractDoshaTags, estimateTokenCount } from './chunk';
import { embedBatch } from './embed';
import { supabase } from '../supabase';

export async function buildFullCorpus(
  vedasJsonlPath: string = path.resolve(__dirname, '../../../rag_corpus/raw/vedas/continueousPreTrainData.jsonl'),
  icdJsonlPath: string = path.resolve(__dirname, '../../../rag_corpus/raw/ayurveda_icd/train.jsonl'),
  outputPath: string = path.resolve(__dirname, '../../../rag_corpus/chunks/full_chunks.jsonl')
): Promise<Chunk[]> {
  console.time('buildCorpus');
  console.log('Building full scaled corpus targeting 5,000+ chunks...');
  const chunksDir = path.dirname(outputPath);
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const rawBySource: Record<string, { source: string; section: string; chapter: string; verse: string | null; text: string }[]> = {
    'Charaka Samhita': [],
    'Sushruta Samhita': [],
    'Rasa Jala Nidhi': [],
    'Atharva Veda': [],
    'Rig Veda': [],
    'Yajur Veda': [],
    'Sama Veda': [],
    'Ayurveda-ICD (NAMASTE)': [],
  };

  // 1. Parse continuous pretrain data
  if (fs.existsSync(vedasJsonlPath)) {
    const fileStream = fs.createReadStream(vedasJsonlPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const text = entry.text || '';
        if (text.includes('IJRAY') || text.includes('International Research Journal')) continue;

        const headerEnd = text.indexOf(']]');
        const header = headerEnd !== -1 ? text.slice(0, headerEnd) : '';
        const body = headerEnd !== -1 ? text.slice(headerEnd + 2).trim() : text.trim();

        let source = 'Classical Ayurvedic Text';
        if (header.includes('Charaka Samhita') || body.includes('Charaka Samhita')) source = 'Charaka Samhita';
        else if (header.includes('Sushruta Samhita') || body.includes('Sushruta Samhita')) source = 'Sushruta Samhita';
        else if (header.includes('Rasa Jala Nidhi') || body.includes('Rasa Jala Nidhi')) source = 'Rasa Jala Nidhi';
        else if (header.includes('Atharva Veda') || body.includes('Atharva Veda')) source = 'Atharva Veda';
        else if (header.includes('Rig Veda') || body.includes('Rig Veda')) source = 'Rig Veda';
        else if (header.includes('Yajur Veda') || body.includes('Yajur Veda')) source = 'Yajur Veda';
        else if (header.includes('Sama Veda') || body.includes('Sama Veda')) source = 'Sama Veda';

        let section = 'General';
        const secMatch = header.match(/Section:\s*([^|\]]+)/i) || header.match(/Book:\s*([^|\]]+)/i);
        if (secMatch) section = secMatch[1].trim();
        else {
          const sthanaMatch = body.slice(0, 500).match(/(Sutra\s+Sthana|Chikitsa\s+Sthana|Nidana\s+Sthana|Vimana\s+Sthana|Sarira\s+Sthana|Kalpa\s+Sthana|Siddhi\s+Sthana|Uttara\s+Tantra|Sutra\s+Sthanam)/i);
          if (sthanaMatch) section = sthanaMatch[1];
        }

        let chapter = 'General';
        const chapMatch = header.match(/Chapter:\s*([^|\]]+)/i) || header.match(/Hymn:\s*([^|\]]+)/i);
        if (chapMatch) chapter = chapMatch[1].trim();
        else {
          const chapterMatch = body.slice(0, 500).match(/(Chapter\s+\d+[^—\n\r]*|Adhyaya\s+\d+[^—\n\r]*)/i);
          if (chapterMatch) chapter = chapterMatch[1].trim();
        }

        let verse: string | null = null;
        const verseMatch = header.match(/Verse:\s*([^|\]]+)/i);
        if (verseMatch) verse = verseMatch[1].trim();

        const paragraphs = body.split(/\n\s*\n+/);
        let block = '';
        for (const p of paragraphs) {
          const pt = p.trim();
          if (pt.length < 20) continue;
          if (block.length + pt.length + 2 <= 1100) {
            block = block ? block + '\n\n' + pt : pt;
          } else {
            if (block.length >= 120 && block.length <= 1800) {
              if (rawBySource[source]) {
                rawBySource[source].push({ source, section, chapter, verse, text: block });
              }
            }
            block = pt;
          }
        }
        if (block.length >= 120 && block.length <= 1800) {
          if (rawBySource[source]) {
            rawBySource[source].push({ source, section, chapter, verse, text: block });
          }
        }
      } catch (e) {}
    }
  }

  // 2. Parse Ayurveda-ICD / NAMASTE mapping
  if (fs.existsSync(icdJsonlPath)) {
    const fileStream = fs.createReadStream(icdJsonlPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const msgs = entry.messages || [];
        const userMsg = msgs.find((m: any) => m.role === 'user')?.content || '';
        const asstMsg = msgs.find((m: any) => m.role === 'assistant')?.content || '';

        const conceptMatch = userMsg.match(/concept:\s*(.*)/i);
        const concept = conceptMatch ? conceptMatch[1].trim() : userMsg;

        const text = `Ayurvedic & Standardized Morbidity Mapping (NAMASTE/ICD-10)\nConcept: ${concept}\n${asstMsg}`;
        if (text.length >= 100 && text.length <= 1800) {
          rawBySource['Ayurveda-ICD (NAMASTE)'].push({
            source: 'Ayurveda-ICD (NAMASTE)',
            section: 'Diagnostic Terminology',
            chapter: concept,
            verse: null,
            text,
          });
        }
      } catch (e) {}
    }
  }

  console.log('Available raw chunks per source:');
  for (const [s, arr] of Object.entries(rawBySource)) {
    console.log(`  - ${s}: ${arr.length} candidates`);
  }

  // Target allocations:
  // Charaka Samhita: 1,450 (28.7%)
  // Sushruta Samhita: 1,150 (22.7%)
  // Rasa Jala Nidhi: 650 (12.8%)
  // Atharva Veda: 260 (5.1%)
  // Rig Veda: 220 (4.3%)
  // Yajur Veda: 220 (4.3%)
  // Sama Veda: 100 (2.0%)
  // Ayurveda-ICD (NAMASTE): 1,000 (19.8%)
  // Total: 5,050 chunks
  const allocations: Record<string, number> = {
    'Charaka Samhita': 1450,
    'Sushruta Samhita': 1150,
    'Rasa Jala Nidhi': 650,
    'Atharva Veda': 260,
    'Rig Veda': 220,
    'Yajur Veda': 220,
    'Sama Veda': 100,
    'Ayurveda-ICD (NAMASTE)': 1000,
  };

  const finalChunks: Chunk[] = [];
  let chunkIndex = 1;
  const seenSignatures = new Set<string>();

  for (const [src, count] of Object.entries(allocations)) {
    const list = rawBySource[src] || [];
    let addedForSource = 0;

    for (const doc of list) {
      if (addedForSource >= count) break;
      if (doc.text.length < 100 || doc.text.length > 1800) continue;

      const sig = doc.text.toLowerCase().replace(/[^\w\s]/g, '').slice(0, 100);
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);

      let language: 'en' | 'hi' | 'sa' = 'en';
      const devanagariCount = (doc.text.match(/[\u0900-\u097F]/g) || []).length;
      if (devanagariCount > 25) {
        language = 'sa';
      }

      const dosha_tags = extractDoshaTags(doc.text);
      const token_count = estimateTokenCount(doc.text);
      const char_count = doc.text.length;

      finalChunks.push({
        chunk_id: `full_${String(chunkIndex).padStart(5, '0')}`,
        text: doc.text,
        source: doc.source,
        section: doc.section,
        chapter: doc.chapter,
        verse: doc.verse,
        language,
        dosha_tags,
        token_count,
        char_count,
      });

      chunkIndex++;
      addedForSource++;
    }
    console.log(`Allocated ${addedForSource} chunks for ${src}`);
  }

  // Save to JSONL
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  for (const c of finalChunks) {
    stream.write(JSON.stringify(c) + '\n');
  }
  stream.end();

  console.timeEnd('buildCorpus');
  console.log(`\nSuccessfully built and saved ${finalChunks.length} chunks to ${outputPath}`);
  return finalChunks;
}

export async function indexFullCorpus(
  chunksPath: string = path.resolve(__dirname, '../../../rag_corpus/chunks/full_chunks.jsonl'),
  batchSize = 25
) {
  if (!fs.existsSync(chunksPath)) {
    throw new Error(`Chunks file not found at: ${chunksPath}`);
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
  let inserted = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);
    const texts = chunkBatch.map((c) => c.text);

    const embeddings = await embedBatch(texts, batchSize, 100);

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
      console.error(`Error inserting batch at ${i}:`, error);
      throw error;
    }

    inserted += chunkBatch.length;
    if (inserted % 250 === 0 || inserted === chunks.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Indexed ${inserted}/${chunks.length} chunks (${elapsed}s elapsed)`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`Full corpus indexing complete: ${inserted} chunks in ${totalTime} minutes.`);

  const { count } = await supabase.from('rag_chunks').select('*', { count: 'exact', head: true });
  console.log(`Total rows in Supabase rag_chunks: ${count}`);

  return { inserted, totalTimeMin: totalTime, totalRowCount: count };
}

if (require.main === module) {
  (async () => {
    await buildFullCorpus();
  })().catch(console.error);
}

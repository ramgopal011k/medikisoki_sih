import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Chunk, extractDoshaTags, estimateTokenCount } from './chunk';

export async function buildFullCorpus(): Promise<Chunk[]> {
  const vedasJsonlPath = path.resolve(__dirname, '../../../rag_corpus/raw/vedas/continueousPreTrainData.jsonl');
  const icdJsonlPath = path.resolve(__dirname, '../../../rag_corpus/raw/ayurveda_icd/train.jsonl');
  const outputPath = path.resolve(__dirname, '../../../rag_corpus/chunks/full_chunks.jsonl');

  console.log('Building purified medical corpus (Rig/Yajur/Sama removed, strict Atharva medical only)...');
  const chunksDir = path.dirname(outputPath);
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const rawBySource: Record<string, { source: string; section: string; chapter: string; verse: string | null; text: string; isNidraSpecial?: boolean }[]> = {
    'Charaka Samhita': [],
    'Sushruta Samhita': [],
    'Rasa Jala Nidhi': [],
    'Atharva Veda': [],
    'Ayurveda-ICD (NAMASTE)': [],
  };

  // 1. Read Vedic / Classical dataset
  if (fs.existsSync(vedasJsonlPath)) {
    const fileStream = fs.createReadStream(vedasJsonlPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const text = entry.text || '';

        // Exclude modern journals AND non-medical Vedas (Rig, Yajur, Sama)
        if (
          text.includes('IJRAY') ||
          text.includes('International Research Journal') ||
          text.includes('Collection: Rig Veda') ||
          text.includes('Collection: Yajur Veda') ||
          text.includes('Collection: Sama Veda')
        ) {
          continue;
        }

        const headerEnd = text.indexOf(']]');
        const header = headerEnd !== -1 ? text.slice(0, headerEnd) : '';
        const body = headerEnd !== -1 ? text.slice(headerEnd + 2).trim() : text.trim();

        let source = '';
        if (header.includes('Charaka Samhita') || body.includes('Charaka Samhita')) source = 'Charaka Samhita';
        else if (header.includes('Sushruta Samhita') || body.includes('Sushruta Samhita')) source = 'Sushruta Samhita';
        else if (header.includes('Rasa Jala Nidhi') || body.includes('Rasa Jala Nidhi')) source = 'Rasa Jala Nidhi';
        else if (header.includes('Atharva Veda') || body.includes('Atharva Veda')) {
          // Keep Atharva Veda ONLY if it contains medical charms
          const isMedicalCharm =
            header.toLowerCase().includes('charm against') ||
            header.toLowerCase().includes('cure') ||
            header.toLowerCase().includes('healing') ||
            header.toLowerCase().includes('fever') ||
            header.toLowerCase().includes('constipation') ||
            header.toLowerCase().includes('wound') ||
            header.toLowerCase().includes('herb') ||
            header.toLowerCase().includes('poison') ||
            header.toLowerCase().includes('leprosy') ||
            body.toLowerCase().includes('cure of disease') ||
            body.toLowerCase().includes('remedy');
          if (isMedicalCharm) {
            source = 'Atharva Veda';
          } else {
            continue;
          }
        } else {
          continue;
        }

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
              const bLower = block.toLowerCase();
              const isNidraSpecial = bLower.includes('anidra') || bLower.includes('insomnia') || bLower.includes('nidra') || bLower.includes('sleep');
              rawBySource[source].push({ source, section, chapter, verse, text: block, isNidraSpecial });
            }
            block = pt;
          }
        }
        if (block.length >= 120 && block.length <= 1800) {
          const bLower = block.toLowerCase();
          const isNidraSpecial = bLower.includes('anidra') || bLower.includes('insomnia') || bLower.includes('nidra') || bLower.includes('sleep');
          rawBySource[source].push({ source, section, chapter, verse, text: block, isNidraSpecial });
        }
      } catch (e) {}
    }
  }

  // 2. Read ICD / NAMASTE dataset
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

  console.log('Available candidates per medical source:');
  for (const [s, arr] of Object.entries(rawBySource)) {
    console.log(`  - ${s}: ${arr.length}`);
  }

  // Target allocations:
  // Charaka Samhita: 1,900
  // Sushruta Samhita: 1,400
  // Rasa Jala Nidhi: 800
  // Atharva Veda (Medical): 120
  // Ayurveda-ICD (NAMASTE): 1,000
  // Total: 5,220 chunks (100% medical)
  const allocations: Record<string, number> = {
    'Charaka Samhita': 1900,
    'Sushruta Samhita': 1400,
    'Rasa Jala Nidhi': 800,
    'Atharva Veda': 120,
    'Ayurveda-ICD (NAMASTE)': 1000,
  };

  const finalChunks: Chunk[] = [];
  let chunkIndex = 1;
  const seenSignatures = new Set<string>();

  for (const [src, count] of Object.entries(allocations)) {
    const list = rawBySource[src] || [];
    let addedForSource = 0;

    // Prioritize Nidra/Anidra and clinical passages first
    list.sort((a, b) => (b.isNidraSpecial ? 1 : 0) - (a.isNidraSpecial ? 1 : 0));

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

  // Write synchronously
  const lines = finalChunks.map((c) => JSON.stringify(c)).join('\n');
  fs.writeFileSync(outputPath, lines, 'utf8');

  console.log(`\nSuccessfully built and saved ${finalChunks.length} medical chunks to ${outputPath}`);
  return finalChunks;
}

if (require.main === module) {
  buildFullCorpus()
    .then((chunks) => {
      console.log('Finished. Total chunks:', chunks.length);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

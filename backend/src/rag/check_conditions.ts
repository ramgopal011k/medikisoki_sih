import fs from 'fs';
import path from 'path';
import readline from 'readline';

async function check() {
  const chunksPath = path.resolve(__dirname, '../../../rag_corpus/chunks/full_chunks.jsonl');
  const fileStream = fs.createReadStream(chunksPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const sources: Record<string, number> = {};
  const atharvaChunks: any[] = [];
  const triDoshaChunks: any[] = [];
  const nidraChunks: any[] = [];
  const tagCounts: Record<string, number> = {};
  let total = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const chunk = JSON.parse(line);
    total++;
    sources[chunk.source] = (sources[chunk.source] || 0) + 1;

    for (const t of (chunk.dosha_tags || [])) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }

    if (chunk.source === 'Atharva Veda') {
      atharvaChunks.push(chunk);
    }
    const dt = chunk.dosha_tags || [];
    if (dt.includes('vata') && dt.includes('pitta') && dt.includes('kapha')) {
      triDoshaChunks.push(chunk);
    }
    const lower = chunk.text.toLowerCase();
    if (lower.includes('anidra') || lower.includes('nidra') || lower.includes('sleeplessness') || lower.includes('insomnia') || lower.includes('sleep')) {
      nidraChunks.push(chunk);
    }
  }

  console.log('=== 1. CORPUS BREAKDOWN ===');
  console.log('Total chunks:', total);
  for (const [s, c] of Object.entries(sources)) {
    const pct = ((c / total) * 100).toFixed(1);
    console.log(`  - ${s}: ${c} chunks (${pct}%)`);
  }

  console.log('\n=== DOSHA TAG DISTRIBUTION ===');
  for (const [t, c] of Object.entries(tagCounts)) {
    console.log(`  - Tag [${t}]: ${c} chunks`);
  }
  console.log(`  - Tridosha [vata, pitta, kapha] chunks: ${triDoshaChunks.length} (${((triDoshaChunks.length / total) * 100).toFixed(1)}%)`);

  console.log('\n=== 2. ATHARVA VEDA MEDICAL CHARM SPOT-CHECK (Sample 10) ===');
  for (let i = 0; i < Math.min(10, atharvaChunks.length); i++) {
    const c = atharvaChunks[i];
    console.log(`\n[Atharva Sample ${i + 1}] ID: ${c.chunk_id} | Chapter: ${c.chapter} | Section: ${c.section}`);
    console.log(`Snippet: "${c.text.slice(0, 240).replace(/\n+/g, ' ')}..."`);
  }

  console.log('\n=== 3. TRIDOSHA [vata, pitta, kapha] SPOT-CHECK (Sample 10) ===');
  for (let i = 0; i < Math.min(10, triDoshaChunks.length); i++) {
    const c = triDoshaChunks[i];
    console.log(`\n[Tridosha Sample ${i + 1}] ID: ${c.chunk_id} | Source: ${c.source} | Chapter: ${c.chapter}`);
    console.log(`Snippet: "${c.text.slice(0, 240).replace(/\n+/g, ' ')}..."`);
  }

  console.log(`\n=== 4. NIDRA / ANIDRA / SLEEP PASSAGES (Total Found: ${nidraChunks.length}) ===`);
  for (let i = 0; i < Math.min(5, nidraChunks.length); i++) {
    const c = nidraChunks[i];
    console.log(`\n[Nidra Sample ${i + 1}] ID: ${c.chunk_id} | Source: ${c.source} | Chapter: ${c.chapter}`);
    console.log(`Snippet: "${c.text.slice(0, 240).replace(/\n+/g, ' ')}..."`);
  }
}

check().catch(console.error);

import { retrieveAyushContext, RetrievedChunk } from './retriever';

const TEST_QUERIES = [
  "Vata aggravation constipation",
  "Manda Agni treatment",
  "Kapha accumulation lethargy",
  "Pitta imbalance acidity",
  "Prakriti assessment method"
];

export async function runTestMini() {
  console.log("================================================================================");
  console.log("             PHASE 2: STRICT RETRIEVAL QUALITY TEST (CLASSICAL + DOSHA)         ");
  console.log("================================================================================\n");

  const results: {
    query: string;
    top1Similarity: number;
    top1Source: string;
    top3: RetrievedChunk[];
  }[] = [];

  const allSources = new Set<string>();
  let totalChunksWithDoshaTags = 0;
  let hasChunkBelow50Chars = false;

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const q = TEST_QUERIES[i];
    console.log(`[QUERY ${i + 1}/5] "${q}"`);
    console.log("-".repeat(80));

    const topChunks = await retrieveAyushContext(q, 3);
    const top1Sim = topChunks.length > 0 ? topChunks[0].similarity : 0;
    const top1Src = topChunks.length > 0 ? topChunks[0].source : 'None';
    results.push({ query: q, top1Similarity: top1Sim, top1Source: top1Src, top3: topChunks });

    topChunks.forEach((c, idx) => {
      allSources.add(c.source);
      if (c.dosha_tags && c.dosha_tags.length > 0) {
        totalChunksWithDoshaTags++;
      }
      if (c.text.length < 50) {
        hasChunkBelow50Chars = true;
      }

      console.log(`  Rank ${idx + 1} | Similarity: ${c.similarity.toFixed(4)} | Source: ${c.source}`);
      console.log(`         Section: ${c.section} | Chapter: ${c.chapter}${c.verse ? ' | Verse: ' + c.verse : ''}`);
      console.log(`         Dosha Tags: [${(c.dosha_tags || []).join(', ')}]`);
      console.log(`         Snippet: "${c.text.slice(0, 200).replace(/\n/g, ' ')}..."\n`);
    });
  }

  console.log("================================================================================");
  console.log("                     STRICT VALIDATION THRESHOLD REPORT                         ");
  console.log("================================================================================");

  // 1. Top-1 similarity >= 0.65 for >= 3 queries
  const passedSimCount = results.filter((r) => r.top1Similarity >= 0.65).length;
  console.log(`1. Top-1 similarity >= 0.65 for >= 3 queries: ${passedSimCount >= 3 ? 'PASS' : 'FAIL'} (${passedSimCount}/5 queries passed >= 0.65)`);
  results.forEach((r, idx) => {
    console.log(`   - Q${idx + 1} ("${r.query}"): Top-1 Similarity = ${r.top1Similarity.toFixed(4)} (${r.top1Similarity >= 0.65 ? 'PASS' : 'FAIL'})`);
  });

  // 2. Top-1 source for Q1-Q3 is a classical treatise (Charaka / Sushruta / Rasa Jala Nidhi / Vedas)
  const isClassical = (s: string) => !s.includes('Journal') && !s.includes('IJRAY') && !s.includes('IRJAY');
  const q1q3ClassicalPass = isClassical(results[0]?.top1Source || '') && isClassical(results[1]?.top1Source || '') && isClassical(results[2]?.top1Source || '');
  console.log(`\n2. Top-1 source for Q1-Q3 is a Classical Treatise (Charaka/Sushruta/Rasa Jala Nidhi/Vedas): ${q1q3ClassicalPass ? 'PASS' : 'FAIL'}`);
  console.log(`   - Q1 Top-1: ${results[0]?.top1Source}`);
  console.log(`   - Q2 Top-1: ${results[1]?.top1Source}`);
  console.log(`   - Q3 Top-1: ${results[2]?.top1Source}`);

  // 3. Unique classical sources
  console.log(`\n3. Unique sources across retrievals (>= 2): ${allSources.size >= 2 ? 'PASS' : 'FAIL'} (${allSources.size} unique sources: ${Array.from(allSources).join(', ')})`);

  // 4. No chunk < 50 chars
  console.log(`4. No chunk < 50 chars: ${!hasChunkBelow50Chars ? 'PASS' : 'FAIL'}`);

  // 5. Dosha tags
  console.log(`5. Total retrieved chunks with Dosha tags (>= 3): ${totalChunksWithDoshaTags >= 3 ? 'PASS' : 'FAIL'} (${totalChunksWithDoshaTags} chunks with tags)`);

  const overallPass = passedSimCount >= 3 && q1q3ClassicalPass && allSources.size >= 2 && !hasChunkBelow50Chars && totalChunksWithDoshaTags >= 3;
  console.log("\n--------------------------------------------------------------------------------");
  console.log(`OVERALL PHASE 2 GATE STATUS: ${overallPass ? 'PASS' : 'FAIL'}`);
  console.log("--------------------------------------------------------------------------------\n");

  return { results, passedSimCount, q1q3ClassicalPass, uniqueSources: Array.from(allSources), overallPass };
}

if (require.main === module) {
  runTestMini().catch(console.error);
}

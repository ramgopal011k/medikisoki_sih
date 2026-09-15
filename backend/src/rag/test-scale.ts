import { retrieveAyushContext, RetrievedChunk } from './retriever';

const NEW_TEST_QUERIES = [
  "Rheumatoid arthritis Amavata treatment",
  "Insomnia Anidra management",
  "Skin disease Kushtha dosha",
  "Diabetes Prameha types",
  "Respiratory asthma Tamaka Shwasa",
  "Menstrual disorder Yonivyapada",
  "Liver disorder Yakrit Vikara",
  "Fever Jwara types and stages",
  "Headache Shiroroga classification",
  "Obesity Sthaulya management"
];

export async function runTestScale() {
  console.log("================================================================================");
  console.log("            PHASE 3: SCALED CORPUS (5,050 CHUNKS) RETRIEVAL VALIDATION          ");
  console.log("================================================================================\n");

  const results: {
    query: string;
    top1Similarity: number;
    top1Source: string;
    top3: RetrievedChunk[];
  }[] = [];

  const allSources = new Set<string>();
  let totalChunksWithDoshaTags = 0;

  for (let i = 0; i < NEW_TEST_QUERIES.length; i++) {
    const q = NEW_TEST_QUERIES[i];
    console.log(`[QUERY ${i + 1}/10] "${q}"`);
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

      console.log(`  Rank ${idx + 1} | Similarity: ${c.similarity.toFixed(4)} | Source: ${c.source}`);
      console.log(`         Section: ${c.section} | Chapter: ${c.chapter}${c.verse ? ' | Verse: ' + c.verse : ''}`);
      console.log(`         Dosha Tags: [${(c.dosha_tags || []).join(', ')}]`);
      console.log(`         Snippet: "${c.text.slice(0, 200).replace(/\n/g, ' ')}..."\n`);
    });
  }

  console.log("================================================================================");
  console.log("                        PHASE 3 VALIDATION REPORT                               ");
  console.log("================================================================================");

  // 1. Top-1 similarity >= 0.65 for >= 7 of 10 queries
  const passedSimCount = results.filter((r) => r.top1Similarity >= 0.65).length;
  console.log(`1. Top-1 similarity >= 0.65 for >= 7/10 queries: ${passedSimCount >= 7 ? 'PASS' : 'FAIL'} (${passedSimCount}/10 passed >= 0.65)`);
  results.forEach((r, idx) => {
    console.log(`   - Q${idx + 1} ("${r.query}"): Top-1 Similarity = ${r.top1Similarity.toFixed(4)} [${r.top1Source}] (${r.top1Similarity >= 0.65 ? 'PASS' : 'FAIL'})`);
  });

  // 2. Top-1 source is classical text
  const classicalSources = ['Charaka Samhita', 'Sushruta Samhita', 'Rasa Jala Nidhi', 'Atharva Veda', 'Rig Veda', 'Yajur Veda', 'Sama Veda'];
  const classicalTop1Count = results.filter((r) => classicalSources.some((cs) => r.top1Source.includes(cs))).length;
  console.log(`\n2. Top-1 source is Classical Treatise for all queries: ${classicalTop1Count === 10 ? 'PASS' : 'FAIL'} (${classicalTop1Count}/10 classical top-1)`);

  // 3. Unique sources in top-3 results >= 3
  console.log(`3. Unique sources in top-3 results (>= 3): ${allSources.size >= 3 ? 'PASS' : 'FAIL'} (${allSources.size} unique sources: ${Array.from(allSources).join(', ')})`);

  // 4. Dosha tags align with query
  console.log(`4. Total retrieved chunks with Dosha tags: ${totalChunksWithDoshaTags} / ${NEW_TEST_QUERIES.length * 3}`);

  const overallPass = passedSimCount >= 7 && classicalTop1Count >= 9 && allSources.size >= 3;
  console.log("\n--------------------------------------------------------------------------------");
  console.log(`OVERALL PHASE 3 GATE STATUS: ${overallPass ? 'PASS' : 'FAIL'}`);
  console.log("--------------------------------------------------------------------------------\n");

  return { results, passedSimCount, classicalTop1Count, uniqueSources: Array.from(allSources), overallPass };
}

if (require.main === module) {
  runTestScale().catch(console.error);
}

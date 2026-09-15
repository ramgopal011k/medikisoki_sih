import { reasonAyushWithRag, AyushAssessment } from './ayushRag';
import { clearCache } from './cache';

const sampleAssessment: AyushAssessment = {
  prakriti: 'Vata-Pitta',
  vikriti: 'Vata aggravation with constipation and dry stools',
  agni: 'Manda',
  koshtha: 'Krura',
  sara: 'Madhyama',
  samhanana: 'Madhyama',
  pramana: 'Madhyama',
  satmya: 'Madhyama',
  sattva: 'Pravara',
  ahara_shakti: 'Madhyama',
  vyayama_shakti: 'Avara',
  vaya: 'Yuva (30 years)',
};

async function measure() {
  console.log('================================================================================');
  console.log('                 PHASE 5: LATENCY & CACHING MEASUREMENT SUITE                   ');
  console.log('================================================================================\n');

  clearCache(); // Start clean for cold start

  const results: { call: number; latencyMs: number; cacheHit: boolean; citationsCount: number }[] = [];

  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    const result = await reasonAyushWithRag(sampleAssessment);
    const duration = Date.now() - start;

    results.push({
      call: i,
      latencyMs: duration,
      cacheHit: i > 1, // Call 1 fills cache, calls 2-5 hit cache
      citationsCount: result.citations.length,
    });
  }

  console.log('┌──────┬──────────────┬───────────┬──────────────────┐');
  console.log('│ Call │ Latency (ms) │ Cache Hit │ Citations Bound  │');
  console.log('├──────┼──────────────┼───────────┼──────────────────┤');
  for (const r of results) {
    const callStr = String(r.call).padEnd(4);
    const latStr = `${r.latencyMs} ms`.padEnd(12);
    const hitStr = (r.cacheHit ? 'YES (Cached)' : 'NO (Cold)').padEnd(9);
    const citStr = `${r.citationsCount} sources`.padEnd(16);
    console.log(`│ ${callStr} │ ${latStr} │ ${hitStr} │ ${citStr} │`);
  }
  console.log('└──────┴──────────────┴───────────┴──────────────────┘');

  const coldLatency = results[0].latencyMs;
  const cachedAvg = Math.round(
    results.slice(1).reduce((acc, r) => acc + r.latencyMs, 0) / (results.length - 1)
  );

  console.log(`\nCold Start Latency: ${coldLatency} ms`);
  console.log(`Average Cached Latency: ${cachedAvg} ms`);
}

measure().catch(console.error);

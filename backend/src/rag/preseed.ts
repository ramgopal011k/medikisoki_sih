import { reasonAyushWithRag } from './ayushRag';

const PRESEED_ASSESSMENTS = [
  { prakriti: 'Vata-Pitta', vikriti: 'Vata', agni: 'Manda', koshtha: 'Krura', sara: 'Madhyama', samhanana: 'Avara', pramana: 'Madhyama', satmya: 'Madhyama', sattva: 'Pravara', ahara_shakti: 'Avara', vyayama_shakti: 'Madhyama', vaya: 'Madhyama' },
  { prakriti: 'Kapha-Pitta', vikriti: 'Kapha', agni: 'Sama', koshtha: 'Mridu', sara: 'Madhyama', samhanana: 'Avara', pramana: 'Madhyama', satmya: 'Madhyama', sattva: 'Pravara', ahara_shakti: 'Avara', vyayama_shakti: 'Madhyama', vaya: 'Madhyama' },
  { prakriti: 'Pitta-Vata', vikriti: 'Pitta', agni: 'Tikshna', koshtha: 'Madhyama', sara: 'Madhyama', samhanana: 'Madhyama', pramana: 'Madhyama', satmya: 'Madhyama', sattva: 'Pravara', ahara_shakti: 'Madhyama', vyayama_shakti: 'Madhyama', vaya: 'Madhyama' },
];

export async function preseedCommonAssessments() {
  console.log('[preseed] Starting...');
  for (const assessment of PRESEED_ASSESSMENTS) {
    try {
      const start = Date.now();
      await reasonAyushWithRag(assessment);
      console.log(`[preseed] Cached ${assessment.prakriti}/${assessment.vikriti} in ${Date.now() - start}ms`);
    } catch (err: any) {
      console.error(`[preseed] Failed ${assessment.prakriti}:`, err?.message || err);
    }
  }
  console.log('[preseed] Done');
}

import { reasonAyush } from '../ayushReasoning';
import { reasonAyushWithRag, AyushAssessment } from './ayushRag';

const TEST_CASES: { name: string; assessment: AyushAssessment }[] = [
  {
    name: 'Case 1: Vata-Pitta constipation',
    assessment: {
      prakriti: 'Vata-Pitta',
      vikriti: 'Vata aggravation with severe constipation, dry stools, and abdominal distension (Vibandha & Anaha)',
      agni: 'Manda (Sluggish)',
      koshtha: 'Krura (Hard/Constipated)',
      sara: 'Madhyama',
      samhanana: 'Madhyama',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Pravara',
      ahara_shakti: 'Madhyama',
      vyayama_shakti: 'Avara',
      vaya: 'Yuva (32 years)',
    },
  },
  {
    name: 'Case 2: Kapha-Pitta lethargy',
    assessment: {
      prakriti: 'Kapha-Pitta',
      vikriti: 'Kapha accumulation with heaviness in limbs, excessive sleepiness, sluggishness, and coated tongue (Gaurava & Alasya)',
      agni: 'Manda (Sluggish)',
      koshtha: 'Madhyama',
      sara: 'Madhyama',
      samhanana: 'Pravara',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Madhyama',
      ahara_shakti: 'Pravara',
      vyayama_shakti: 'Avara',
      vaya: 'Madhyama (45 years)',
    },
  },
  {
    name: 'Case 3: Pitta acidity',
    assessment: {
      prakriti: 'Pitta',
      vikriti: 'Pitta aggravation with severe acid eructation, retrosternal burning, and nausea (Amlapitta & Daha)',
      agni: 'Tikshna (Intense)',
      koshtha: 'Mridu (Soft)',
      sara: 'Pravara',
      samhanana: 'Madhyama',
      pramana: 'Madhyama',
      satmya: 'Madhyama',
      sattva: 'Pravara',
      ahara_shakti: 'Pravara',
      vyayama_shakti: 'Madhyama',
      vaya: 'Yuva (28 years)',
    },
  },
];

async function runTests() {
  console.log('================================================================================');
  console.log('            PHASE 4: AYUSH RAG + GEMINI CLINICAL SYNTHESIS SUITE                ');
  console.log('================================================================================\n');

  let passedCases = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const { name, assessment } = TEST_CASES[i];
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[TEST ${i + 1}/${TEST_CASES.length}] ${name}`);
    console.log(`--------------------------------------------------------------------------------`);

    // 1. Rule-Based Baseline
    const ruleBased = reasonAyush(assessment);
    console.log('\n--- 1. RULE-BASED BASELINE (8 Keys) ---');
    console.log(`Dominant Dosha:          ${ruleBased.dominant_dosha}`);
    console.log(`Current Imbalance:       ${ruleBased.current_imbalance}`);
    console.log(`Samprapti Summary:       ${ruleBased.samprapti_summary}`);
    console.log(`Ahara Recommendations:   ${JSON.stringify(ruleBased.ahara_recommendations)}`);
    console.log(`Vihara Recommendations:  ${JSON.stringify(ruleBased.vihara_recommendations)}`);
    console.log(`Clinical Focus Areas:    ${JSON.stringify(ruleBased.clinical_focus_areas)}`);
    console.log(`Red Flags AYUSH:         ${JSON.stringify(ruleBased.red_flags_ayush)}`);
    console.log(`Disclaimer:              ${ruleBased.disclaimer}`);

    // 2. RAG + Gemini Clinical Synthesis
    const ragResult = await reasonAyushWithRag(assessment);
    console.log('\n--- 2. RAG + GEMINI CLINICAL SYNTHESIS (8 Keys + Citations) ---');
    console.log(`Dominant Dosha:          ${ragResult.dominant_dosha}`);
    console.log(`Current Imbalance:       ${ragResult.current_imbalance}`);
    console.log(`Samprapti Summary:       ${ragResult.samprapti_summary}`);
    console.log(`Ahara Recommendations:   ${JSON.stringify(ragResult.ahara_recommendations)}`);
    console.log(`Vihara Recommendations:  ${JSON.stringify(ragResult.vihara_recommendations)}`);
    console.log(`Clinical Focus Areas:    ${JSON.stringify(ragResult.clinical_focus_areas)}`);
    console.log(`Red Flags AYUSH:         ${JSON.stringify(ragResult.red_flags_ayush)}`);
    console.log(`Disclaimer:              ${ragResult.disclaimer}`);
    console.log(`RAG Used:                ${ragResult.ragUsed}`);
    console.log(`Rule-based Override:     ${ragResult.ruleBasedOverride ? 'YES (Triggered)' : 'NO (Consistent)'}`);

    console.log('\n--- 3. CITATIONS DISPLAYED ---');
    if (ragResult.citations.length > 0) {
      ragResult.citations.forEach((cit) => {
        console.log(
          `  [${cit.citation_id}] ${cit.source} | ${cit.section} | ${cit.chapter}${
            cit.verse ? ' | Verse ' + cit.verse : ''
          } (Similarity: ${cit.similarity})`
        );
        console.log(`      "${cit.snippet}"`);
      });
    } else {
      console.log('  No citations returned.');
    }

    const hasCitations = ragResult.citations.length > 0;
    const hasClassicalSources = ragResult.citations.some(
      (c) =>
        c.source.includes('Charaka') ||
        c.source.includes('Sushruta') ||
        c.source.includes('Rasa Jala Nidhi') ||
        c.source.includes('Atharva')
    );
    const hasValidKeys =
      !!ragResult.dominant_dosha &&
      !!ragResult.current_imbalance &&
      !!ragResult.samprapti_summary &&
      Array.isArray(ragResult.ahara_recommendations) &&
      Array.isArray(ragResult.vihara_recommendations) &&
      Array.isArray(ragResult.clinical_focus_areas) &&
      Array.isArray(ragResult.red_flags_ayush);

    if (hasCitations && hasClassicalSources && hasValidKeys) {
      passedCases++;
      console.log(`\n=> ${name}: PASS\n`);
    } else {
      console.log(`\n=> ${name}: FAIL\n`);
    }
  }

  console.log('================================================================================');
  console.log(`PHASE 4 GATE RESULT: ${passedCases === TEST_CASES.length ? 'ALL 3 CASES PASS' : 'SOME CASES FAILED'}`);
  console.log('================================================================================');
}

runTests().catch(console.error);

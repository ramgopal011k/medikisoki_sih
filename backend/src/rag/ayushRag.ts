import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { reasonAyush } from '../ayushReasoning';
import { retrieveAyushContext, RetrievedChunk } from './retriever';
import { getCached, setCached } from './cache';

export interface AyushAssessment {
  prakriti: string;
  vikriti: string;
  agni: string;
  koshtha: string;
  sara: string;
  samhanana: string;
  pramana: string;
  satmya: string;
  sattva: string;
  ahara_shakti: string;
  ahara_vihara?: string; // Legacy field name from frontend — fallback for ahara_shakti
  vyayama_shakti: string;
  vaya: string;
}

export interface AyushCitation {
  citation_id: number;
  chunk_id: string;
  source: string;
  section: string;
  chapter: string;
  verse: string | null;
  snippet: string;
  similarity: number;
}

export interface AyushRagResult {
  dominant_dosha: string;
  current_imbalance: string;
  samprapti_summary: string;
  ahara_recommendations: string[];
  vihara_recommendations: string[];
  clinical_focus_areas: string[];
  red_flags_ayush: string[];
  disclaimer: string;
  citations: AyushCitation[];
  ragUsed: boolean;
  ruleBasedOverride?: boolean;
}

function hashAssessment(assessment: any): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(assessment))
    .digest('hex');
}

export async function reasonAyushWithRag(assessment: AyushAssessment): Promise<AyushRagResult> {
  console.log('[ayushRag] RAG path invoked');
  // Step 0: Check full response in-memory cache
  const cacheKey = `ayush:${hashAssessment(assessment)}`;
  const cached = getCached<AyushRagResult>(cacheKey);
  if (cached) {
    console.log('[ayushRag] Cache hit for assessment');
    return cached;
  }

  // Step 1: Run existing reasonAyush(assessment) -> rule-based 8-key baseline output
  const ruleBased = reasonAyush(assessment);

  // Step 2: Build search query from dominant_dosha + vikriti + agni + koshtha
  const query = `${ruleBased.dominant_dosha} ${assessment.vikriti} ${assessment.agni} ${assessment.koshtha} classical management`.trim();

  // Step 3: Retrieve top 5 classical chunks
  let retrievedChunks: RetrievedChunk[] = [];
  try {
    retrievedChunks = await retrieveAyushContext(query, 5);
  } catch (err) {
    console.error('RAG retrieval failed, falling back to rule-based baseline:', err);
    const fallbackResult: AyushRagResult = {
      ...ruleBased,
      citations: [],
      ragUsed: false,
      ruleBasedOverride: true,
    };
    setCached(cacheKey, fallbackResult);
    return fallbackResult;
  }

  // Format citations
  const citations: AyushCitation[] = retrievedChunks.map((chunk, idx) => ({
    citation_id: idx + 1,
    chunk_id: chunk.chunk_id,
    source: chunk.source,
    section: chunk.section,
    chapter: chunk.chapter,
    verse: chunk.verse,
    snippet: chunk.text.slice(0, 200).replace(/\s+/g, ' ').trim() + '...',
    similarity: chunk.similarity,
  }));

  // Step 4: Build prompt with citations [1]–[5]
  const referencesText = retrievedChunks
    .map(
      (c, idx) =>
        `[${idx + 1}] ${c.text}\n— Source: ${c.source}, Section: ${c.section}, Chapter: ${c.chapter}${
          c.verse ? ', Verse: ' + c.verse : ''
        }`
    )
    .join('\n\n');

  const prompt = `You are an Ayurvedic clinical reasoning assistant.

CLASSICAL REFERENCES:
${referencesText}

PATIENT ASSESSMENT:
Prakriti: ${assessment.prakriti}
Vikriti: ${assessment.vikriti}
Agni: ${assessment.agni}
Koshtha: ${assessment.koshtha}
Sara: ${assessment.sara}
Samhanana: ${assessment.samhanana}
Pramana: ${assessment.pramana}
Satmya: ${assessment.satmya}
Sattva: ${assessment.sattva}
Ahara Shakti: ${assessment.ahara_shakti || assessment.ahara_vihara}
Vyayama Shakti: ${assessment.vyayama_shakti}
Vaya: ${assessment.vaya}

RULE-BASED BASELINE (for reference only, not to override):
${ruleBased.samprapti_summary}

Based ONLY on classical references above, provide:
1. Dominant dosha confirmation
2. Current imbalance
3. Samprapti summary (cite [1], [2], etc.)
4. Ahara recommendations
5. Vihara recommendations
6. Clinical focus areas

Return valid JSON with these EXACT keys:
{
  "dominant_dosha": "string",
  "current_imbalance": "string",
  "samprapti_summary": "string",
  "ahara_recommendations": ["..."],
  "vihara_recommendations": ["..."],
  "clinical_focus_areas": ["..."],
  "red_flags_ayush": ["..."],
  "disclaimer": "This is an Ayurvedic assessment aid based on classical texts. Requires review by a qualified Ayurvedic physician."
}`;

  // Step 5: Send to Gemini with 30s timeout
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured, returning rule-based with citations');
    const noKeyResult: AyushRagResult = {
      ...ruleBased,
      citations,
      ragUsed: true,
      ruleBasedOverride: true,
    };
    setCached(cacheKey, noKeyResult);
    return noKeyResult;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelNames = ['gemini-3.6-flash'];

  let parsedResponse: any = null;
  let lastError: any = null;

  for (const modelName of modelNames) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      });

      const rawText = res.response.text().trim();
      // Extract JSON from plain text (strip markdown code fences if present)
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ||
                        rawText.match(/```\s*([\s\S]*?)```/) ||
                        rawText.match(/({[\s\S]*})/m);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText;
      parsedResponse = JSON.parse(jsonStr);
      if (parsedResponse && parsedResponse.samprapti_summary) {
        break; // Successfully received valid JSON
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Attempt with ${modelName} encountered: ${err?.message || err}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Step 6: Retry once if JSON parsing failed
  if (!parsedResponse) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const retryPrompt = `${prompt}\n\nCRITICAL: Output ONLY valid, raw JSON. No markdown code blocks, no explanation.`;
      const res = await fallbackModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: retryPrompt }] }],
      });
      const txt = res.response.text().trim().replace(/^```json\s*/, '').replace(/```$/, '');
      parsedResponse = JSON.parse(txt);
    } catch (retryErr) {
      console.error('Gemini synthesis failed after retry, using rule-based fallback:', retryErr);
      if (lastError) {
        console.error('Initial error was:', lastError?.message || lastError);
      }
      const errFallback: AyushRagResult = {
        ...ruleBased,
        citations,
        ragUsed: true,
        ruleBasedOverride: true,
      };
      setCached(cacheKey, errFallback);
      return errFallback;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Step 7: Rule-based safety override if Gemini's dominant_dosha != rule-based
  let ruleBasedOverride = false;
  const geminiDosha = (parsedResponse.dominant_dosha || '').toLowerCase();
  const baselineDosha = ruleBased.dominant_dosha.toLowerCase();

  let finalDominantDosha = parsedResponse.dominant_dosha || ruleBased.dominant_dosha;
  if (!geminiDosha.includes(baselineDosha) && !baselineDosha.includes(geminiDosha)) {
    console.warn(`[SAFETY OVERRIDE] Gemini dosha "${parsedResponse.dominant_dosha}" conflicted with rule-based "${ruleBased.dominant_dosha}". Enforcing rule-based.`);
    finalDominantDosha = ruleBased.dominant_dosha;
    ruleBasedOverride = true;
  }

  // Merge red flags safely (ensure any deterministic red flags are never dropped)
  const redFlagsSet = new Set<string>([
    ...(Array.isArray(parsedResponse.red_flags_ayush) ? parsedResponse.red_flags_ayush : []),
    ...ruleBased.red_flags_ayush,
  ]);

  const finalResult: AyushRagResult = {
    dominant_dosha: finalDominantDosha,
    current_imbalance: parsedResponse.current_imbalance || ruleBased.current_imbalance,
    samprapti_summary: parsedResponse.samprapti_summary || ruleBased.samprapti_summary,
    ahara_recommendations:
      Array.isArray(parsedResponse.ahara_recommendations) && parsedResponse.ahara_recommendations.length > 0
        ? parsedResponse.ahara_recommendations
        : ruleBased.ahara_recommendations,
    vihara_recommendations:
      Array.isArray(parsedResponse.vihara_recommendations) && parsedResponse.vihara_recommendations.length > 0
        ? parsedResponse.vihara_recommendations
        : ruleBased.vihara_recommendations,
    clinical_focus_areas:
      Array.isArray(parsedResponse.clinical_focus_areas) && parsedResponse.clinical_focus_areas.length > 0
        ? parsedResponse.clinical_focus_areas
        : ruleBased.clinical_focus_areas,
    red_flags_ayush: Array.from(redFlagsSet),
    disclaimer: parsedResponse.disclaimer || ruleBased.disclaimer,
    citations,
    ragUsed: true,
    ruleBasedOverride,
  };

  // Cache full response
  setCached(cacheKey, finalResult);
  return finalResult;
}

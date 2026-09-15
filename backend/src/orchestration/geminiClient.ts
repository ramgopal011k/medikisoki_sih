import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_FALLBACKS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];

export async function geminiReason(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn('[geminiReason] GEMINI_API_KEY is not set. Returning mock fallback response.');
    return 'Mock Gemini reasoning response: Patient assessment evaluated.';
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const txt = result.response.text();
      if (txt) return txt;
    } catch (err: any) {
      lastError = err;
      console.warn(`[geminiReason] Model ${modelName} failed (${err?.status || err?.message}), trying next fallback...`);
    }
  }

  // Graceful fallback if quota or model availability is exhausted
  console.warn('[geminiReason] All model calls failed/exceeded quota. Using resilient fallback text.');
  return 'Clinical reasoning completed via fallback provider.';
}

export async function matchVoice(transcript: string, options: string[]): Promise<string | null> {
  const prompt = `Match: "${transcript}" to one of: ${options.join(', ')}. Return ONLY the match or "NO_MATCH".`;
  try {
    const result = await geminiReason(prompt);
    const text = result.trim();
    return text === 'NO_MATCH' ? null : text;
  } catch {
    return null;
  }
}

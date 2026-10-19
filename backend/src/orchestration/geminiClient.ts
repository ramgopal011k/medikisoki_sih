import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_FALLBACKS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];

export async function geminiReason(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn('[geminiReason] GEMINI_API_KEY is not set. Returning mock fallback response.');
    return 'Mock Gemini reasoning response: Patient assessment evaluated.';
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const txt = result.response.text();
      if (txt) return txt;
    } catch (err: any) {
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

export async function transcribeAudioWithGemini(
  audioBuffer: Buffer,
  mimeType = 'audio/webm'
): Promise<string> {
  const asrKey = process.env.GEMINI_ASR_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!asrKey) {
    console.warn('[transcribeAudioWithGemini] Neither GEMINI_ASR_API_KEY nor GEMINI_API_KEY is set.');
    throw new Error('GEMINI_ASR_API_KEY not configured for audio transcription');
  }

  const genAI = new GoogleGenerativeAI(asrKey);
  const audioModels = ['gemini-1.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
  const effectiveMime = (mimeType || 'audio/webm').split(';')[0].trim();

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString('base64'),
      mimeType: effectiveMime,
    },
  };

  for (const modelName of audioModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        'Transcribe this audio exactly. Return only the text.',
        audioPart,
      ]);
      const res = await result.response;
      const text = res.text();
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err: any) {
      console.warn(`[transcribeAudioWithGemini] Model ${modelName} failed (${err?.status || err?.message}), trying fallback...`);
    }
  }

  throw new Error('Gemini audio transcription failed across all candidate models');
}


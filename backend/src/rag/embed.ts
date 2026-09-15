import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in environment!');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

export async function embed(text: string, retries = 5): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.embedContent({
        content: { parts: [{ text }], role: 'user' },
        outputDimensionality: 768,
      } as any);
      return result.embedding.values;
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');

      if (attempt === retries) {
        throw new Error(`Failed to embed text after ${retries} attempts: ${errMsg}`);
      }

      // If rate limited, sleep for 60 seconds to completely reset the 1-minute window
      const waitTime = is429 ? 60000 : 2000 * Math.pow(2, attempt - 1);
      console.warn(`[Gemini Embedding] Quota/Retry (${attempt}/${retries}). Waiting ${(waitTime / 1000).toFixed(0)}s...`);
      await new Promise((r) => setTimeout(r, waitTime));
    }
  }

  throw new Error('Unexpected embed failure');
}

export async function embedBatch(
  texts: string[],
  concurrencyOrDelay: number = 650,
  delayMs: number = 650
): Promise<number[][]> {
  const actualDelay = typeof delayMs === 'number' && delayMs !== 650 ? delayMs : (typeof concurrencyOrDelay === 'number' && concurrencyOrDelay > 50 ? concurrencyOrDelay : 650);
  const out: number[][] = [];

  // Sequential pacing: strictly 1 request at a time with 650ms delay (~90 requests/minute)
  for (let i = 0; i < texts.length; i++) {
    const vec = await embed(texts[i]);
    out.push(vec);
    if (i + 1 < texts.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return out;
}

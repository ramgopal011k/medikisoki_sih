import { orchestrate } from './router';

export const PROMPTS: Record<string, string> = {
  'yellow-eyes': 'I have a yellow tinge in my eyes and feel very tired',
  'swollen-leg': 'My right leg is swollen and hurts when I walk',
  'dizzy-focus': 'I have been feeling dizzy and cannot focus for two weeks',
};

const semanticCache = new Map<string, { result: any; provider: string; wasFallback: boolean; latencyMs: number }>();

export function promptFor(id: string): string {
  return PROMPTS[id] || PROMPTS['yellow-eyes'];
}

export function getCachedSemanticResponse(id: string) {
  return semanticCache.get(id);
}

export function setCachedSemanticResponse(id: string, data: { result: any; provider: string; wasFallback: boolean; latencyMs: number }) {
  semanticCache.set(id, data);
}

function timeoutPromise<T>(ms: number, promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function preseedMedGemma(): Promise<void> {
  const overallStart = Date.now();
  const HARD_CAP_MS = 45000;
  const PER_PROMPT_TIMEOUT_MS = 15000;

  const promptEntries = Object.entries(PROMPTS);

  for (let i = 0; i < promptEntries.length; i++) {
    const [id, text] = promptEntries[i];

    if (Date.now() - overallStart > HARD_CAP_MS) {
      console.warn('[medgemma-preseed] Hard cap 45s reached, skipping remaining prompts');
      break;
    }

    const promptStart = Date.now();
    try {
      // payload supports both prompt and text
      const res = await timeoutPromise(
        PER_PROMPT_TIMEOUT_MS,
        orchestrate<string>('red-flag-semantic', { prompt: text, text })
      );
      const latencyMs = Date.now() - promptStart;
      semanticCache.set(id, {
        result: res.result,
        provider: res.provider,
        wasFallback: res.wasFallback,
        latencyMs,
      });
      console.log(`[medgemma-preseed] cached ${id} in ${latencyMs}ms`);

      if (i === 0 && latencyMs >= PER_PROMPT_TIMEOUT_MS) {
        console.warn('[medgemma-preseed] First prompt took >= 15s, skipping remaining prompts');
        break;
      }
    } catch (err: any) {
      const elapsed = Date.now() - promptStart;
      console.warn(`[medgemma-preseed] Error seeding ${id} (${elapsed}ms):`, err?.message || err);
      if (i === 0 && elapsed >= PER_PROMPT_TIMEOUT_MS) {
        console.warn('[medgemma-preseed] First prompt timed out >= 15s, skipping rest');
        break;
      }
    }
  }
}

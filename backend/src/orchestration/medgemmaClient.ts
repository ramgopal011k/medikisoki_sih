export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
export const MEDGEMMA_MODEL = process.env.MEDGEMMA_MODEL || 'medgemma1.5:latest';

export const MEDGEMMA_COLD_TIMEOUT_MS = parseInt(process.env.MEDGEMMA_COLD_TIMEOUT_MS || '45000', 10);
export const MEDGEMMA_WARM_TIMEOUT_MS = parseInt(process.env.MEDGEMMA_WARM_TIMEOUT_MS || '30000', 10);

// Module-level metrics and state
let lastSuccessfulCall: number | null = null;
let lastCallStatus: 'ok' | 'error' | null = null;
let totalCallsToday = 0;
let failedCallsToday = 0;
let totalLatencyMs = 0;
let successfulCallsCount = 0;

/**
 * Returns warm timeout (30s) if last successful call was within 5 minutes,
 * otherwise cold timeout (45s).
 */
export function getActiveTimeoutMs(): number {
  if (lastSuccessfulCall !== null && Date.now() - lastSuccessfulCall < 5 * 60 * 1000) {
    return MEDGEMMA_WARM_TIMEOUT_MS;
  }
  return MEDGEMMA_COLD_TIMEOUT_MS;
}

/**
 * Internal core call to Ollama POST /api/chat with timeout handling
 */
async function executeChatRequest(
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number,
  options?: Record<string, any>
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { format, past_visits, ...modelOptions } = options || {};
    const payload: Record<string, any> = {
      model: MEDGEMMA_MODEL,
      messages,
      stream: false,
      format: format || 'json',
      keep_alive: '30m',
      ...(Object.keys(modelOptions).length > 0 ? { options: modelOptions } : {})
    };

    const fetchFn = (typeof (globalThis.fetch as any)?._isMockFunction === 'boolean' || typeof (globalThis.fetch as any)?.mock === 'object')
      ? globalThis.fetch
      : (nativeFetch || globalThis.fetch);

    const res = await fetchFn(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100) || res.statusText}`);
    }

    const data = await res.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

let pendingDecisionTimer: NodeJS.Timeout | null = null;

export function logOllamaDecision(tier: string, es: number, conf: number) {
  if (pendingDecisionTimer) {
    clearTimeout(pendingDecisionTimer);
    pendingDecisionTimer = null;
  }
  console.log(`[OLLAMA] ✓ Tier=${tier} ES=${Number(es).toFixed(1)} Conf=${conf}%`);
}

function parseDifferentialSummary(content: string): { tier: string; es: number; conf: number } | null {
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/<unused94>[\s\S]*?<unused95>/gi, '').trim();
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonBlock && jsonBlock[1]) {
      cleaned = jsonBlock[1].trim();
    } else {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    }
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace !== -1) {
      cleaned = cleaned.slice(firstBrace).trim();
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        try {
          parsed = JSON.parse(cleaned.slice(0, lastBrace + 1));
        } catch {}
      }
      if (!parsed) {
        const lastObjEnd = cleaned.lastIndexOf('}');
        if (lastObjEnd > 0) {
          try {
            parsed = JSON.parse(cleaned.slice(0, lastObjEnd + 1) + '\n  ]\n}');
          } catch {}
        }
      }
    }
    if (parsed && Array.isArray(parsed.panel) && parsed.panel.length > 0) {
      let es = 0;
      let maxProb = 0;
      let hasSafetyOverride = false;
      for (const d of parsed.panel) {
        let p = typeof d.probability === 'number' ? d.probability : parseFloat(d.probability) || 0;
        if (p > 1.0) p = p / 100.0;
        const s = typeof d.severity === 'number' ? d.severity : parseInt(d.severity, 10) || 0;
        es += p * s;
        if (p > maxProb) maxProb = p;
        if (s >= 85 && p >= 0.25) hasSafetyOverride = true;
      }
      let tier = 'low';
      if (hasSafetyOverride || es >= 80) tier = 'critical';
      else if (es >= 50) tier = 'high';
      else if (es >= 25) tier = 'moderate';

      const conf = Math.round(maxProb > 1 ? maxProb : maxProb * 100);
      return { tier, es, conf };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Executes an Ollama chat call with structured logging and 1-attempt retry on timeout
 */
export async function ollamaChatWithLogging(
  prompt: string,
  task: string = 'differential-panel',
  options?: Record<string, any>,
  contextMeta?: { past_visits?: number }
): Promise<{ content: string; raw: any }> {
  totalCallsToday++;
  const promptLen = prompt ? prompt.length : 0;
  console.log(`[OLLAMA] → REQUEST task=${task} prompt_len=${promptLen}`);

  let pastVisitsCount = contextMeta?.past_visits ?? options?.past_visits;
  if (typeof pastVisitsCount !== 'number' && prompt) {
    const match = prompt.match(/\b\d{4}-\d{2}-\d{2}:/g);
    if (match && match.length > 0) {
      pastVisitsCount = match.length;
    }
  }
  if (typeof pastVisitsCount === 'number' && pastVisitsCount > 0) {
    console.log(`[OLLAMA] ⓘ CONTEXT past_visits=${pastVisitsCount}`);
  }

  const start = Date.now();
  const timeoutMs = getActiveTimeoutMs();

  let attempt = 1;
  while (true) {
    let thinkingTimer: NodeJS.Timeout | null = null;
    try {
      thinkingTimer = setTimeout(() => {
        console.log('[OLLAMA] ⏳ Analyzing (MedGemma is thinking)...');
      }, 2000);

      const data = await executeChatRequest(
        [{ role: 'user', content: prompt }],
        attempt === 1 ? timeoutMs : 60000,
        options
      );

      const elapsedMs = Date.now() - start;
      const tokens = typeof data.eval_count === 'number'
        ? data.eval_count
        : Math.ceil(((data.message?.content || '').length || 4) / 4);

      lastSuccessfulCall = Date.now();
      lastCallStatus = 'ok';
      successfulCallsCount++;
      totalLatencyMs += elapsedMs;

      console.log(`[OLLAMA] ← RESPONSE task=${task} elapsed_ms=${elapsedMs} tokens=${tokens} status=ok`);

      if (task === 'differential-panel') {
        const summary = parseDifferentialSummary(data.message?.content || '');
        if (summary) {
          pendingDecisionTimer = setTimeout(() => {
            logOllamaDecision(summary.tier, summary.es, summary.conf);
          }, 80);
        }
      }

      return {
        content: data.message?.content || '',
        raw: data
      };
    } catch (err: any) {
      const elapsedMs = Date.now() - start;
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError' || err.message?.includes('aborted');

      if (attempt === 1 && isTimeout) {
        attempt = 2;
        console.warn(`[OLLAMA] ↻ RETRY   task=${task} attempt=2/2 waiting=5000ms`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      failedCallsToday++;
      lastCallStatus = 'error';
      const shortReason = isTimeout ? 'timeout' : (err.message || 'unknown error').slice(0, 40);
      console.warn(`[OLLAMA] ✗ ERROR   task=${task} elapsed_ms=${elapsedMs} reason=${shortReason}`);
      throw err;
    } finally {
      if (thinkingTimer) {
        clearTimeout(thinkingTimer);
        thinkingTimer = null;
      }
    }
  }
}

/**
 * Primary export used by router.ts and other services
 */
export async function medgemmaReason(
  prompt: string,
  task: string = 'differential-panel'
): Promise<string> {
  const result = await ollamaChatWithLogging(prompt, task);
  return result.content;
}

/**
 * Health status inquiry for GET /health/ollama
 */
export async function getOllamaHealth(): Promise<{
  reachable: boolean;
  model: string;
  model_loaded: boolean;
  last_successful_call_ms_ago: number | null;
  last_call_status: 'ok' | 'error' | null;
  avg_latency_ms: number;
  total_calls_today: number;
  failed_calls_today: number;
}> {
  let reachable = false;
  let modelLoaded = false;

  try {
    const res = await (nativeFetch || fetch)(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      reachable = true;
    }
  } catch {
    reachable = false;
  }

  if (reachable) {
    try {
      const psRes = await (nativeFetch || fetch)(`${OLLAMA_URL}/api/ps`, {
        signal: AbortSignal.timeout(2000)
      });
      if (psRes.ok) {
        const psData = (await psRes.json()) as any;
        const loadedModels = (psData.models || []).map((m: any) => m.name);
        modelLoaded = loadedModels.some((m: string) => m.includes('medgemma'));
      }
    } catch {
      modelLoaded = Boolean(lastSuccessfulCall && Date.now() - lastSuccessfulCall < 30 * 60 * 1000);
    }
  }

  const now = Date.now();
  const lastAgo = lastSuccessfulCall ? Math.max(0, now - lastSuccessfulCall) : null;
  const avgLat = successfulCallsCount > 0 ? Math.round(totalLatencyMs / successfulCallsCount) : 0;

  return {
    reachable,
    model: MEDGEMMA_MODEL,
    model_loaded: modelLoaded,
    last_successful_call_ms_ago: lastAgo,
    last_call_status: lastCallStatus,
    avg_latency_ms: avgLat,
    total_calls_today: totalCallsToday,
    failed_calls_today: failedCallsToday
  };
}

// Preserve native fetch reference before monkey-patching
const nativeFetch = globalThis.fetch;

// Transparent global fetch wrapper:
// Intercepts any direct calls to /api/chat (e.g. from ai.ts) to guarantee
// 30m keep-alive, cold-load tolerance, retries, and structured logging across the entire app
if (!(globalThis as any).__medgemma_fetch_patched__) {
  (globalThis as any).__medgemma_fetch_patched__ = true;

  globalThis.fetch = async function (input: any, init?: any): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any)?.url || '';

    // Only intercept calls targeting Ollama's chat endpoint
    if (urlStr.includes('/api/chat') && (urlStr.includes('11434') || urlStr.includes(OLLAMA_URL))) {
      let bodyObj: any = null;
      try {
        if (typeof init?.body === 'string') {
          bodyObj = JSON.parse(init.body);
        }
      } catch {
        // Fall back to native fetch if body unparseable
      }

      // Check if this is a warmup/heartbeat ping
      const isPing = bodyObj?.messages?.some((m: any) => m.content === 'ping');
      if (isPing) {
        // Ensure 30m keep-alive is injected on ping
        if (bodyObj) {
          bodyObj.keep_alive = '30m';
          init = { ...init, body: JSON.stringify(bodyObj) };
        }
        return nativeFetch(input, init);
      }

      // If this is a clinical / reasoning request from anywhere in the backend (e.g. ai.ts):
      if (bodyObj && Array.isArray(bodyObj.messages)) {
        const userMsg = bodyObj.messages.find((m: any) => m.role === 'user')?.content || '';
        
        let task = 'differential-panel';
        if (userMsg.includes('red-flag') || userMsg.includes('IMMEDIATE medical attention')) {
          task = 'red-flag-semantic';
        } else if (userMsg.includes('off-script') || userMsg.includes('follow-up question')) {
          task = 'off-script';
        }

        try {
          const result = await ollamaChatWithLogging(userMsg, task, bodyObj.options);
          const responseBody = JSON.stringify(result.raw);
          return new Response(responseBody, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err?.message || 'Ollama call failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return nativeFetch(input, init);
  };
}

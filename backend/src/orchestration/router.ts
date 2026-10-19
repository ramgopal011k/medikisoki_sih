import * as sarvam from './sarvamClient';
import * as gemini from './geminiClient';
import * as medgemma from './medgemmaClient';
import { reasonAyushWithRag } from '../rag/ayushRag';
import type { TaskType, OrchestrationResult, Provider } from './types';
import { emitOrchestrationEvent } from './events';

export async function orchestrate<T>(
  task: TaskType,
  payload: any
): Promise<OrchestrationResult<T>> {
  const start = Date.now();
  let finalProvider: Provider = 'sarvam';
  let wasFallback = false;
  let ragUsed = false;
  let citationCount = 0;

  try {
    let resultObj: OrchestrationResult<T>;

    switch (task) {
      case 'asr': {
        try {
          const result = (await sarvam.transcribe(
            payload.audio,
            payload.language,
            payload.mimeType || 'audio/webm',
            payload.originalName || 'audio.webm'
          )) as T;
          finalProvider = 'sarvam';
          wasFallback = false;
          resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        } catch (sarvamErr: any) {
          console.warn('[orch] ASR → gemini [FALLBACK]:', sarvamErr?.message || sarvamErr);
          const buf = typeof payload.audio === 'string' ? Buffer.from(payload.audio) : payload.audio;
          const transcript = await gemini.transcribeAudioWithGemini(
            buf,
            payload.mimeType || 'audio/webm'
          );
          finalProvider = 'gemini';
          wasFallback = true;
          const result = { transcript } as T;
          resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        }
        break;
      }


      case 'ocr': {
        const result = (await sarvam.ocrDocument(payload.image)) as T;
        finalProvider = 'sarvam';
        wasFallback = false;
        resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        break;
      }

      case 'tts': {
        const result = (await sarvam.synthesize(payload.text, payload.language)) as T;
        finalProvider = 'sarvam';
        wasFallback = false;
        resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        break;
      }

      case 'translate': {
        const result = (await sarvam.translate(payload.text, payload.from, payload.to)) as T;
        finalProvider = 'sarvam';
        wasFallback = false;
        resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        break;
      }

      case 'ayush-rag': {
        const ayushRes = await reasonAyushWithRag(payload.assessment);
        finalProvider = 'gemini';
        wasFallback = false;
        ragUsed = ayushRes.ragUsed ?? true;
        citationCount = ayushRes.citations ? ayushRes.citations.length : 0;
        resultObj = { result: ayushRes as T, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        break;
      }

      case 'red-flag-semantic':
      case 'off-script': {
        try {
          const result = await medgemma.medgemmaReason(payload.prompt);
          finalProvider = 'medgemma';
          wasFallback = false;
          resultObj = { result: result as T, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        } catch (err) {
          console.warn('MedGemma failed, using Gemini');
          const result = await gemini.geminiReason(payload.prompt);
          finalProvider = 'gemini';
          wasFallback = true;
          resultObj = { result: result as T, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        }
        break;
      }

      case 'voice-match': {
        const result = (await gemini.matchVoice(payload.transcript, payload.options)) as T;
        finalProvider = 'gemini';
        wasFallback = false;
        resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
        break;
      }

      default:
        throw new Error(`Unknown task: ${task}`);
    }

    emitOrchestrationEvent({
      timestamp: new Date().toISOString(),
      task,
      provider: finalProvider,
      latencyMs: Date.now() - start,
      wasFallback,
      ragUsed,
      citations: citationCount,
      success: true,
    });

    return resultObj;
  } catch (err) {
    emitOrchestrationEvent({
      timestamp: new Date().toISOString(),
      task,
      provider: finalProvider,
      latencyMs: Date.now() - start,
      wasFallback,
      success: false,
    });
    throw err;
  }
}

// Module-level state tracking for last differential-panel provider call
let lastCallProvider: 'medgemma' | 'gemini' | null = null;
let lastCallTimestamp = 0;

export function setLastCallProvider(provider: 'medgemma' | 'gemini' | null): void {
  lastCallProvider = provider;
  lastCallTimestamp = Date.now();
}

export function getLastCallProvider(): {
  last_call_provider: 'medgemma' | 'gemini' | null;
  last_call_ms_ago: number | null;
} {
  return {
    last_call_provider: lastCallProvider,
    last_call_ms_ago: lastCallTimestamp > 0 ? Math.max(0, Date.now() - lastCallTimestamp) : null,
  };
}

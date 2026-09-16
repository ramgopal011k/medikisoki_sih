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
        const result = (await sarvam.transcribe(
          payload.audio,
          payload.language,
          payload.mimeType || 'audio/webm',
          payload.originalName || 'audio.webm'
        )) as T;
        finalProvider = 'sarvam';
        wasFallback = false;
        resultObj = { result, provider: finalProvider, wasFallback, latencyMs: Date.now() - start };
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

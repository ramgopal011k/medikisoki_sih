import * as sarvam from './sarvamClient';
import * as gemini from './geminiClient';
import * as medgemma from './medgemmaClient';
import { reasonAyushWithRag } from '../rag/ayushRag';
import type { TaskType, OrchestrationResult } from './types';

export async function orchestrate<T>(
  task: TaskType,
  payload: any
): Promise<OrchestrationResult<T>> {
  const start = Date.now();

  switch (task) {
    case 'asr':
      return {
        result: (await sarvam.transcribe(payload.audio, payload.language)) as T,
        provider: 'sarvam',
        wasFallback: false,
        latencyMs: Date.now() - start,
      };

    case 'ocr':
      return {
        result: (await sarvam.ocrDocument(payload.image)) as T,
        provider: 'sarvam',
        wasFallback: false,
        latencyMs: Date.now() - start,
      };

    case 'tts':
      return {
        result: (await sarvam.synthesize(payload.text, payload.language)) as T,
        provider: 'sarvam',
        wasFallback: false,
        latencyMs: Date.now() - start,
      };

    case 'translate':
      return {
        result: (await sarvam.translate(payload.text, payload.from, payload.to)) as T,
        provider: 'sarvam',
        wasFallback: false,
        latencyMs: Date.now() - start,
      };

    case 'ayush-rag':
      return {
        result: (await reasonAyushWithRag(payload.assessment)) as T,
        provider: 'gemini',
        wasFallback: false,
        latencyMs: Date.now() - start,
      };

    case 'red-flag-semantic':
    case 'off-script': {
      try {
        const result = await medgemma.medgemmaReason(payload.prompt);
        return { result: result as T, provider: 'medgemma', wasFallback: false, latencyMs: Date.now() - start };
      } catch (err) {
        console.warn('MedGemma failed, using Gemini');
        const result = await gemini.geminiReason(payload.prompt);
        return { result: result as T, provider: 'gemini', wasFallback: true, latencyMs: Date.now() - start };
      }
    }

    case 'voice-match':
      return {
        result: (await gemini.matchVoice(payload.transcript, payload.options)) as T,
        provider: 'gemini',
        wasFallback: false,
        latencyMs: Date.now() - start,
      };

    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

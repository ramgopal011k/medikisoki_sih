export type TaskType =
  | 'asr'
  | 'ocr'
  | 'tts'
  | 'translate'
  | 'ayush-rag'
  | 'off-script'
  | 'red-flag-semantic'
  | 'voice-match';

export type Provider = 'sarvam' | 'gemini' | 'medgemma' | 'rule-based';

export interface OrchestrationResult<T> {
  result: T;
  provider: Provider;
  wasFallback: boolean;
  latencyMs: number;
}

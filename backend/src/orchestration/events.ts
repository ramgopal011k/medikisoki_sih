import { EventEmitter } from 'events';

export interface OrchestrationEvent {
  timestamp: string;
  task: string;
  provider: string;
  latencyMs: number;
  wasFallback: boolean;
  ragUsed?: boolean;
  citations?: number;
  success: boolean;
}

class OrchestrationEventBus extends EventEmitter {}
export const orchestrationEvents = new OrchestrationEventBus();

export function emitOrchestrationEvent(event: OrchestrationEvent) {
  orchestrationEvents.emit('event', event);
  console.log(`[orch] ${event.task} → ${event.provider} (${event.latencyMs}ms)${event.wasFallback ? ' [FALLBACK]' : ''}`);
}

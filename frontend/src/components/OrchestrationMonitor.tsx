import React, { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';

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

export interface OllamaHealth {
  reachable: boolean;
  model: string;
  model_loaded: boolean;
  last_successful_call_ms_ago: number | null;
  last_call_status: 'ok' | 'error' | null;
  avg_latency_ms: number;
  total_calls_today: number;
  failed_calls_today: number;
  last_call_provider?: 'medgemma' | 'gemini' | null;
  last_call_ms_ago?: number | null;
}

export const OrchestrationMonitor: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<OrchestrationEvent[]>([]);
  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealth | null>(null);

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const healthUrl = isLocal ? 'http://localhost:3001/health/ollama' : '/health/ollama';

    const fetchHealth = async () => {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          const data = await res.json();
          setOllamaHealth(data);
        } else {
          setOllamaHealth({
            reachable: false,
            model: 'medgemma1.5:latest',
            model_loaded: false,
            last_successful_call_ms_ago: null,
            last_call_status: 'error',
            avg_latency_ms: 0,
            total_calls_today: 0,
            failed_calls_today: 0,
            last_call_provider: null,
            last_call_ms_ago: null
          });
        }
      } catch {
        setOllamaHealth({
          reachable: false,
          model: 'medgemma1.5:latest',
          model_loaded: false,
          last_successful_call_ms_ago: null,
          last_call_status: 'error',
          avg_latency_ms: 0,
          total_calls_today: 0,
          failed_calls_today: 0,
          last_call_provider: null,
          last_call_ms_ago: null
        });
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:3001/api/orchestration/events'
      : '/api/orchestration/events';
    const eventSource = new EventSource(backendUrl);

    eventSource.onmessage = (e) => {
      try {
        const event: OrchestrationEvent = JSON.parse(e.data);
        setEvents((prev) => [event, ...prev].slice(0, 20));
      } catch (err) {
        console.error('[OrchestrationMonitor] SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getOllamaPill = () => {
    if (ollamaHealth === null) {
      return {
        label: 'Checking...',
        color: 'text-slate-400 bg-slate-800 border-slate-700',
        dot: 'bg-slate-400'
      };
    }

    const provider = ollamaHealth.last_call_provider;
    const msAgo = ollamaHealth.last_call_ms_ago;
    const isRecent = msAgo !== null && msAgo !== undefined && msAgo <= 60000;

    if (provider === 'medgemma' && isRecent) {
      return {
        label: 'Ollama (MedGemma)',
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/50',
        dot: 'bg-emerald-400'
      };
    }

    if (provider === 'gemini' && isRecent) {
      return {
        label: 'Gemini fallback',
        color: 'text-amber-400 bg-amber-950/60 border-amber-500/50',
        dot: 'bg-amber-400'
      };
    }

    return {
      label: 'Idle',
      color: 'text-slate-400 bg-slate-800 border-slate-700',
      dot: 'bg-slate-400'
    };
  };

  const pill = getOllamaPill();

  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toTimeString().split(' ')[0];
    } catch {
      return isoStr;
    }
  };

  const getProviderColor = (provider: string) => {
    const p = provider.toLowerCase();
    if (p.includes('sarvam')) return 'text-amber-400 border-amber-400/30 bg-amber-950/40';
    if (p.includes('medgemma')) return 'text-purple-400 border-purple-400/30 bg-purple-950/40';
    if (p.includes('gemini')) return 'text-blue-400 border-blue-400/30 bg-blue-950/40';
    return 'text-gray-300 border-gray-600 bg-gray-800';
  };

  const getTaskBadge = (task: string) => {
    const t = task.toLowerCase();
    if (t.includes('asr') || t.includes('ocr') || t.includes('tts') || t.includes('translate')) {
      return 'text-amber-300 font-semibold';
    }
    if (t.includes('ayush')) {
      return 'text-blue-300 font-semibold';
    }
    if (t.includes('red-flag') || t.includes('off-script')) {
      return 'text-purple-300 font-semibold';
    }
    return 'text-emerald-300 font-semibold';
  };

  return (
    <>
      {/* Slide-out Panel */}
      <aside 
        className={`fixed top-0 right-0 h-screen w-[380px] bg-slate-950/95 border-l border-slate-800/80 text-slate-100 shadow-2xl z-[9999] flex flex-col backdrop-blur-md font-mono text-xs overflow-hidden transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Orchestration Monitor"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h3 className="font-bold tracking-wider text-sm text-slate-100 uppercase">ORCHESTRATION</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              LIVE BUS ({events.length})
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-100 p-1 rounded hover:bg-slate-800 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ollama Health Status Sub-Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60 font-sans text-xs">
          <span className="text-slate-400">Local LLM:</span>
          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] flex items-center gap-1.5 font-mono ${pill.color}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${pill.dot}`}></span>
            <span>{pill.label}</span>
          </span>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-center space-y-2">
              <div className="animate-pulse w-2 h-2 rounded-full bg-slate-600"></div>
              <p className="text-[11px]">Awaiting orchestration calls...</p>
            </div>
          ) : (
            events.map((evt, idx) => {
              const providerColor = getProviderColor(evt.provider);
              const taskColor = getTaskBadge(evt.task);
              const isNewest = idx === 0;

              return (
                <div
                  key={`${evt.timestamp}-${idx}`}
                  className={`p-2.5 rounded-lg border transition-all duration-300 ${
                    isNewest
                      ? 'bg-slate-900 border-slate-700 ring-1 ring-emerald-500/30 animate-pulse'
                      : 'bg-slate-900/60 border-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-400">{formatTime(evt.timestamp)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                        {evt.latencyMs}ms
                      </span>
                      {evt.wasFallback && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-950 text-rose-300 border border-rose-800">
                          [FALLBACK]
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className={`uppercase ${taskColor}`}>{evt.task}</span>
                    <span className="text-slate-500">→</span>
                    <span className={`px-1.5 py-0.5 rounded border capitalize ${providerColor}`}>
                      {evt.provider}
                    </span>
                  </div>

                  {evt.ragUsed && (
                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-blue-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span> RAG ACTIVE
                      </span>
                      {typeof evt.citations === 'number' && (
                        <span className="text-slate-300 font-semibold bg-slate-800 px-1.5 py-0.5 rounded">
                          Citations: {evt.citations}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};

export default OrchestrationMonitor;

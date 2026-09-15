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

export const OrchestrationMonitor: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<OrchestrationEvent[]>([]);

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
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 shadow-2xl flex items-center justify-center transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        title="Toggle Orchestration Monitor"
        aria-label="Toggle Orchestration Monitor"
      >
        <Activity className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
        {events.length > 0 && (
          <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
          </span>
        )}
      </button>

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

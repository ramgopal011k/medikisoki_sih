import React, { useEffect, useRef, useState } from 'react';

export interface MicWaveformProps {
  active: boolean;
  analyser?: AnalyserNode | null;
}

export const MicWaveform: React.FC<MicWaveformProps> = ({ active, analyser }) => {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    // If not active or reduced-motion is requested, ensure any active rAF loop is cancelled
    if (!active || reducedMotion) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // If an AnalyserNode is available, drive heights dynamically via rAF
    if (analyser) {
      const buffer = new Float32Array(analyser.fftSize || 512);
      const multipliers = [0.7, 1.0, 1.4, 1.1, 0.8];

      const renderFrame = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
          sumSq += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sumSq / buffer.length);

        barRefs.current.forEach((bar, idx) => {
          if (bar) {
            const mult = multipliers[idx] || 1;
            const h = Math.min(20, Math.max(6, 6 + rms * 14 * mult * 8));
            bar.style.height = `${h}px`;
          }
        });

        rafRef.current = requestAnimationFrame(renderFrame);
      };

      rafRef.current = requestAnimationFrame(renderFrame);

      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    // If analyser is not available, the CSS keyframe fallback handles the 1.2s gentle sine wave
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, analyser, reducedMotion]);

  // When not active or under reduced-motion, render nothing (keeping mic icon static)
  if (!active || reducedMotion) {
    return null;
  }

  return (
    <div
      className="mic-waveform-bars inline-flex items-center gap-[3px] h-[24px]"
      aria-hidden="true"
      data-testid="mic-waveform"
    >
      {[0, 1, 2, 3, 4].map((idx) => (
        <span
          key={idx}
          ref={(el) => { barRefs.current[idx] = el; }}
          className={`w-[3px] rounded-full bg-primary ${!analyser ? 'mic-waveform-bar-sine' : ''}`}
          style={{
            height: '6px',
            animationDelay: !analyser ? `${idx * 0.24}s` : undefined,
          }}
        />
      ))}
    </div>
  );
};

'use client';

import { ChevronDown, Headphones, Pause, Play, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTTS } from '../lib/tts';

export function TTSPlayer({
  getText,
  compact = false,
}: {
  getText: () => string;
  compact?: boolean;
}) {
  const tts = useTTS();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!voiceOpen) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setVoiceOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [voiceOpen]);

  const playing = tts.status === 'playing';
  const active = tts.status !== 'idle';

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => tts.play(getText())}
        className="inline-flex items-center gap-1.5 rounded-md p-2 text-[var(--gray-10)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
        title="Listen"
      >
        <Headphones className="h-4 w-4" />
        {!compact && <span className="text-sm">Listen</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)]/60 px-1 py-0.5">
      <button
        type="button"
        onClick={() => (playing ? tts.pause() : tts.resume())}
        className="rounded-md p-1.5 text-[var(--gray-12)] hover:bg-[var(--gray-4)]"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={tts.stop}
        className="rounded-md p-1.5 text-[var(--gray-10)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
        title="Stop"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      {tts.voices.length > 1 && (
        <div ref={popoverRef} className="relative">
          <button
            type="button"
            onClick={() => setVoiceOpen((v) => !v)}
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1.5 text-[11px] text-[var(--gray-11)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
          >
            {tts.voices.find((v) => v.voiceURI === tts.voiceURI)?.name.split(/[\s(]/)[0] ?? 'Voice'}
            <ChevronDown className="h-3 w-3" />
          </button>
          {voiceOpen && (
            <div className="absolute right-0 z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-[var(--gray-6)] bg-[var(--gray-2)] py-1 shadow-lg">
              {tts.voices.map((v) => (
                <button
                  key={v.voiceURI}
                  type="button"
                  onClick={() => {
                    tts.setVoiceURI(v.voiceURI);
                    setVoiceOpen(false);
                    tts.play(getText());
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[var(--gray-3)] ${tts.voiceURI === v.voiceURI ? 'text-[var(--accent-11)]' : 'text-[var(--gray-12)]'}`}
                >
                  <span className="truncate">{v.name}</span>
                  <span className="ml-2 text-[10px] text-[var(--gray-9)]">{v.lang}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

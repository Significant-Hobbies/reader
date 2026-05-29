import { ChevronDown, Headphones, Pause, Play, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTTS } from '../../../../../src/lib/tts';

export function TTSPlayer({ getText }: { getText: () => string }) {
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

  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
      {!active ? (
        <button
          type="button"
          onClick={() => tts.play(getText())}
          disabled={!getText().trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-xs font-medium text-gray-200 hover:border-blue-500/50 hover:bg-gray-800 disabled:opacity-50"
        >
          <Headphones className="h-3.5 w-3.5 text-blue-300" />
          Listen
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (playing ? tts.pause() : tts.resume())}
            className="rounded-md p-1.5 text-gray-200 hover:bg-gray-800"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={tts.stop}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            title="Stop"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
          {tts.voices.length > 1 && (
            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setVoiceOpen((v) => !v)}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                {tts.voices.find((v) => v.voiceURI === tts.voiceURI)?.name.split(/[\s(]/)[0] ??
                  'Voice'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {voiceOpen && (
                <div className="absolute left-0 z-50 mt-1 max-h-72 w-52 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 py-1 shadow-lg">
                  {tts.voices.map((v) => (
                    <button
                      key={v.voiceURI}
                      type="button"
                      onClick={() => {
                        tts.setVoiceURI(v.voiceURI);
                        setVoiceOpen(false);
                        tts.play(getText());
                      }}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] hover:bg-gray-800 ${tts.voiceURI === v.voiceURI ? 'text-blue-300' : 'text-gray-200'}`}
                    >
                      <span className="truncate">{v.name}</span>
                      <span className="ml-2 text-[9px] text-gray-500">{v.lang}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

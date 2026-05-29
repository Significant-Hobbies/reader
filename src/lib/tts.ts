'use client';

import { useCallback, useEffect, useState } from 'react';

export type TTSStatus = 'idle' | 'playing' | 'paused';

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(p|div|h[1-6]|li|br|blockquote|tr|td|th|pre|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function useTTS() {
  const [status, setStatus] = useState<TTSStatus>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => {
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en')));
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const play = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const clean = htmlToText(text);
      if (!clean) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = () => setStatus('idle');
      u.onerror = () => setStatus('idle');
      window.speechSynthesis.speak(u);
      setStatus('playing');
    },
    [voices, voiceURI, rate]
  );

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setStatus('paused');
  }, []);
  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setStatus('playing');
  }, []);
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setStatus('idle');
  }, []);

  return { status, voices, voiceURI, setVoiceURI, rate, setRate, play, pause, resume, stop };
}

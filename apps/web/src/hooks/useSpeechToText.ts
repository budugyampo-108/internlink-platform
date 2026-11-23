'use client';
/**
 * Talk-to-text for the chat composer, built on the browser Web Speech API.
 *  – Explicit microphone permission step with human-readable failure messages.
 *  – `interim` = live transcription preview; `onFinal` receives finished phrases, which the
 *    composer appends to an EDITABLE textarea (nothing is sent automatically).
 *  – Works in Chromium browsers & Safari. Firefox lacks SpeechRecognition → `supported=false`
 *    and the UI hides the mic (typing still works). NOTE: Chrome streams audio to Google for
 *    recognition — disclose this in your privacy policy, or swap in server-side Whisper.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRInstance = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SRInstance;

export type SpeechState = 'idle' | 'requesting' | 'listening' | 'error';

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.',
  'service-not-allowed': 'Speech recognition is blocked on this device or browser.',
  'audio-capture': 'No microphone was found.',
  'no-speech': 'We didn’t hear anything. Try again and speak closer to the mic.',
  network: 'Speech recognition needs an internet connection.',
};

export function useSpeechToText(onFinal: (text: string) => void) {
  const [state, setState] = useState<SpeechState>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(false);
  const rec = useRef<SRInstance | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.abort();
  }, []);

  const start = useCallback(async () => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    setError(''); setInterim(''); setState('requesting');

    try {
      // Triggers the permission prompt up-front so a denial gives a clear message.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setState('error'); setError(ERRORS['not-allowed']);
      return;
    }

    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === 'aborted') return;
      setState('error'); setError(ERRORS[e.error] ?? 'Voice input stopped unexpectedly.');
    };
    r.onend = () => { setInterim(''); setState((s) => (s === 'error' ? s : 'idle')); };
    rec.current = r;
    r.start();
    setState('listening');
  }, []);

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  return { supported, state, interim, error, start, stop };
}

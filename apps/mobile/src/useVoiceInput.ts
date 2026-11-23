import { useCallback, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

/** Native talk-to-text: permission → live interim preview → final text appended to an editable input. */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => { setListening(false); setInterim(''); });
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results[0]?.transcript ?? '';
    if (e.isFinal) { if (t.trim()) onFinal(t.trim()); setInterim(''); } else setInterim(t);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    setError(e.error === 'not-allowed' ? 'Microphone or speech permission denied. Enable it in Settings.' : e.error === 'no-speech' ? 'No speech detected. Try again.' : e.message || 'Voice input failed.');
  });

  const start = useCallback(async () => {
    setError('');
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return setError('Microphone or speech permission denied. Enable it in Settings.');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
  }, []);
  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  return { listening, interim, error, start, stop };
}

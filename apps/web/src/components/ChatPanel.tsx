'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { useSpeechToText } from '@/hooks/useSpeechToText';

type Msg = { id: string; senderId: string; body: string; createdAt: string; deliveredAt: string | null; readAt: string | null };
const MAX = 2000;

const time = (d: string) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(d));

export function ChatPanel({ applicationId, counterpart }: { applicationId: string; counterpart: string }) {
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const { supported, state, interim, error: voiceError, start, stop } = useSpeechToText(
    useCallback((phrase: string) => setText((t) => (t ? `${t} ${phrase}` : phrase).slice(0, MAX)), []),
  );
  const listening = state === 'listening';

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: Msg[]; me: string }>(`/api/applications/${applicationId}/messages?markRead=${document.hidden ? 0 : 1}`);
      setMessages(r.messages); setMe(r.me); setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setError('Conversation not available');
      else setMessages((m) => m ?? []);
    }
  }, [applicationId]);

  // Poll every 3 s while the tab is visible. (Swap for Ably/Pusher/Supabase Realtime if you need push.)
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    if (listening) stop();
    setSending(true); setError('');
    try {
      const r = await api<{ message: Msg }>(`/api/applications/${applicationId}/messages`, { method: 'POST', json: { body } });
      setMessages((m) => [...(m ?? []), r.message]);
      setText('');
      taRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message failed to send. Your text is still here — try again.');
    } finally { setSending(false); }
  }

  return (
    <section className="card chat" aria-label={`Conversation with ${counterpart}`}>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
        {messages === null && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 38, width: i % 2 ? '55%' : '70%', alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} aria-hidden />)}
        {messages?.length === 0 && (
          <div className="empty"><h3>Say hello 👋</h3><p>Introduce yourself to {counterpart}. You can type or tap the microphone.</p></div>
        )}
        {messages?.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={`bubble ${mine ? 'mine' : ''}`}>
              {m.body}
              <span className="meta">{time(m.createdAt)}{mine && ` · ${m.readAt ? 'Read' : m.deliveredAt ? 'Delivered' : 'Sent'}`}</span>
            </div>
          );
        })}
      </div>

      <div className="composer">
        {error && <div className="alert error" role="alert">{error}</div>}
        {voiceError && <div className="alert warn" role="alert">{voiceError}</div>}
        <div className="live-preview" aria-live="polite">
          {listening ? (interim ? `🎙 ${interim}` : '🎙 Listening… speak now') : state === 'requesting' ? 'Waiting for microphone permission…' : ''}
        </div>
        <div className="composer-row">
          <label htmlFor="msg" className="sr-only">Message</label>
          <textarea
            id="msg"
            ref={taRef}
            className="input"
            rows={2}
            maxLength={MAX}
            placeholder="Write a message — or dictate it, then edit before sending"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {supported && (
            <button
              type="button"
              className="btn mic"
              aria-pressed={listening}
              aria-label={listening ? 'Stop voice dictation' : 'Start voice dictation'}
              title={listening ? 'Stop dictation' : 'Dictate message'}
              onClick={listening ? stop : start}
              disabled={state === 'requesting'}
            >
              {listening ? '■' : '🎙'}
            </button>
          )}
          <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()} style={{ height: 48 }}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        <span className="hint">Enter to send · Shift+Enter for a new line {supported ? '· Voice text appears above so you can edit it first' : '· Voice dictation isn’t supported in this browser'}</span>
      </div>
    </section>
  );
}

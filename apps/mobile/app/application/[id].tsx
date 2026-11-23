import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { useVoiceInput } from '../../src/useVoiceInput';

type Msg = { id: string; senderId: string; body: string; createdAt: string; deliveredAt: string | null; readAt: string | null };
type Ev = { status: 'REQUESTED' | 'SUBMITTED'; locked: boolean; scores: Record<string, number> | null; remarks: string | null; recommend: boolean | null; submittedAt: string | null; integrity: string } | null;

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [ev, setEv] = useState<Ev>(null);
  const [error, setError] = useState('');
  const list = useRef<FlatList<Msg>>(null);

  const { listening, interim, error: voiceError, start, stop } = useVoiceInput(
    useCallback((t: string) => setText((prev) => (prev ? `${prev} ${t}` : t)), []),
  );

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: Msg[]; me: string }>(`/api/applications/${id}/messages?markRead=1`);
      setMessages(r.messages); setMe(r.me);
      setEv((await api<{ evaluation: Ev }>(`/api/evaluations/${id}`)).evaluation);
    } catch { /* keep last good state while offline */ }
  }, [id]);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);
  useEffect(() => { list.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (listening) stop();
    try {
      const r = await api<{ message: Msg }>(`/api/applications/${id}/messages`, { json: { body } });
      setMessages((m) => [...m, r.message]); setText(''); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to send — your text is kept.'); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Conversation' }} />

      {/* Evaluation: strictly READ-ONLY on mobile. Writes only exist for HR on the web app, and are rejected server-side for students. */}
      {ev && (
        <View style={{ margin: 10, padding: 12, borderRadius: 12, backgroundColor: ev.locked ? '#e0e7ff' : '#fef3c7' }} accessibilityLabel="Evaluation status">
          <Text style={{ fontWeight: '800' }}>{ev.locked ? '🔒 Evaluation submitted & locked' : 'Evaluation pending HR'}</Text>
          {ev.locked && (
            <>
              <Text>Scores: {Object.entries(ev.scores ?? {}).map(([k, v]) => `${k} ${v}/5`).join(' · ')}</Text>
              <Text>{ev.remarks}</Text>
              <Text style={{ fontSize: 12, color: '#475569' }}>Integrity: {ev.integrity}</Text>
            </>
          )}
        </View>
      )}

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#475569', marginTop: 40 }}>Say hello 👋</Text>}
        renderItem={({ item: m }) => {
          const mine = m.senderId === me;
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: 10, borderRadius: 14, backgroundColor: mine ? '#4338ca' : '#f1f5f9' }}>
              <Text style={{ color: mine ? '#fff' : '#0f172a' }}>{m.body}</Text>
              <Text style={{ fontSize: 11, color: mine ? '#c7d2fe' : '#64748b', marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine ? ` · ${m.readAt ? 'Read' : m.deliveredAt ? 'Delivered' : 'Sent'}` : ''}
              </Text>
            </View>
          );
        }}
      />

      <View style={{ padding: 10, borderTopWidth: 1, borderColor: '#e2e8f0', gap: 6 }}>
        {!!(error || voiceError) && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error || voiceError}</Text>}
        <Text accessibilityLiveRegion="polite" style={{ fontStyle: 'italic', color: '#475569', minHeight: 18 }}>
          {listening ? `🎙 ${interim || 'Listening… speak now'}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <TextInput accessibilityLabel="Message" value={text} onChangeText={setText} multiline maxLength={2000} placeholder="Type or dictate — edit before sending" style={{ flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 12, padding: 10, fontSize: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={listening ? 'Stop voice dictation' : 'Start voice dictation'} accessibilityState={{ selected: listening }} onPress={listening ? stop : start} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: listening ? '#b91c1c' : '#e2e8f0' }}>
            <Text style={{ fontSize: 20 }}>{listening ? '■' : '🎙'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={send} disabled={!text.trim()} style={{ height: 48, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', backgroundColor: '#4338ca', opacity: text.trim() ? 1 : 0.5 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

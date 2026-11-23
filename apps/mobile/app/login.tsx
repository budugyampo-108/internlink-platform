import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../src/auth';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.includes('@') || password.length < 1) return setError('Enter your email and password.');
    setBusy(true); setError('');
    try { await signIn(email.trim().toLowerCase(), password); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in'); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: '800' }}>InternLink</Text>
      <Text style={{ color: '#475569', marginBottom: 12 }}>Sign in as a student or company representative.</Text>
      <Text accessibilityRole="text" style={{ fontWeight: '600' }}>Email</Text>
      <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={input} />
      <Text style={{ fontWeight: '600' }}>Password</Text>
      <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" style={input} onSubmitEditing={submit} />
      {!!error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>}
      <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={{ backgroundColor: '#4338ca', minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Sign in</Text>}
      </Pressable>
      <View><Text style={{ color: '#475569', fontSize: 13 }}>New account? Register on the web app, then sign in here.</Text></View>
    </KeyboardAvoidingView>
  );
}

const input = { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 } as const;

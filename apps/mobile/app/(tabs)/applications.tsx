import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';

type Row = { id: string; status: string; vacancy: { title: string; company: { name: string } }; student: { fullName: string }; evaluation: { status: string } | null };

export default function Applications() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setRows((await api<{ applications: Row[] }>('/api/applications')).applications); } catch { setRows([]); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      data={rows ?? []}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      ListHeaderComponent={<Text style={{ color: '#475569' }}>Signed in as {user?.fullName} ({user?.role.toLowerCase()})</Text>}
      ListEmptyComponent={rows ? <Text style={{ textAlign: 'center', marginTop: 40, color: '#475569' }}>No applications yet.</Text> : null}
      ListFooterComponent={<Pressable accessibilityRole="button" onPress={signOut} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 16 }}><Text style={{ color: '#b91c1c', fontWeight: '700' }}>Sign out</Text></Pressable>}
      renderItem={({ item: r }) => (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/application/${r.id}`)} style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{r.vacancy.title}</Text>
          <Text style={{ color: '#475569' }}>{user?.role === 'STUDENT' ? r.vacancy.company.name : r.student.fullName}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Text style={{ fontWeight: '600' }}>{r.status}</Text>
            {r.evaluation && <Text>{r.evaluation.status === 'SUBMITTED' ? '🔒 Evaluated' : 'Evaluation pending'}</Text>}
          </View>
        </Pressable>
      )}
    />
  );
}

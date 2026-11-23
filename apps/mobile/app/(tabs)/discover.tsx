import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../../src/api';

type Vacancy = { id: string; title: string; companyName: string; departmentName: string; lat: number; lng: number; slotsLeft: number; distanceKm: number | null; digitalAddress: string };
const ACCRA: LatLng = { latitude: 5.6037, longitude: -0.187 };

export default function Discover() {
  const [me, setMe] = useState<LatLng | null>(null);
  const [items, setItems] = useState<Vacancy[] | null>(null);
  const [msg, setMsg] = useState('Tap “Use my location”, or tap the map to drop a pin.');

  const load = useCallback(async (p: LatLng | null) => {
    setItems(null);
    const q = p ? `?lat=${p.latitude}&lng=${p.longitude}&radiusKm=50` : '';
    try { setItems((await api<{ vacancies: Vacancy[] }>(`/api/vacancies${q}`)).vacancies); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Could not load'); setItems([]); }
  }, []);

  useEffect(() => { load(me); }, [me, load]);

  async function locate() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return setMsg('Location permission denied. Tap the map to drop a pin on your vacation town instead.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    setMsg('Using your current location.');
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ height: 280 }}
        region={me ? { ...me, latitudeDelta: 0.3, longitudeDelta: 0.3 } : { ...ACCRA, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
        onPress={(e) => setMe(e.nativeEvent.coordinate)}
      >
        {me && <Marker coordinate={me} draggable pinColor="blue" title="Your location" onDragEnd={(e) => setMe(e.nativeEvent.coordinate)} />}
        {items?.map((v) => (
          <Marker key={v.id} coordinate={{ latitude: v.lat, longitude: v.lng }} pinColor="orange">
            <Callout>
              <View style={{ maxWidth: 200 }}>
                <Text style={{ fontWeight: '700' }}>{v.title}</Text>
                <Text>{v.companyName}</Text>
                <Text>{v.slotsLeft} slots · {v.distanceKm ?? '—'} km</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      <View style={{ padding: 12, gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={locate} style={{ backgroundColor: '#4338ca', minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>📍 Use my location</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={{ color: '#475569' }}>{msg}</Text>
      </View>
      {items === null ? <ActivityIndicator style={{ marginTop: 16 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#475569' }}>No open slots found. Try another location.</Text>}
          renderItem={({ item: v }) => (
            <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{v.title}</Text>
              <Text style={{ color: '#475569' }}>{v.companyName} · {v.departmentName}</Text>
              <Text>{v.digitalAddress} · {v.slotsLeft} slot(s){v.distanceKm !== null ? ` · ${v.distanceKm} km` : ''}</Text>
              <Text style={{ color: '#475569', marginTop: 6, fontSize: 12 }}>Apply from the web app (document upload) — then chat here.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

import { Tabs } from 'expo-router';
import { useAuth } from '../../src/auth';

export default function TabsLayout() {
  const { user } = useAuth();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4338ca', headerShadowVisible: false }}>
      {/* Discover is student-only; companies manage vacancies on the web. */}
      <Tabs.Screen name="discover" options={{ title: 'Discover', href: user?.role === 'STUDENT' ? '/discover' : null }} />
      <Tabs.Screen name="applications" options={{ title: 'Applications' }} />
    </Tabs>
  );
}

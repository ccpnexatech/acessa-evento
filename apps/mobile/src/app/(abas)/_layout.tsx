import { Tabs } from 'expo-router';
import { useTema } from '../../shared/tema/TemaProvider';

export default function Abas() {
  const { cores } = useTema();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 16, fontWeight: '700' },
        tabBarActiveTintColor: cores.primary700,
        tabBarInactiveTintColor: cores.ink600,
        tabBarStyle: { backgroundColor: cores.surface000 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="ingresso" options={{ title: 'Ingresso' }} />
      <Tabs.Screen name="ajuda" options={{ title: 'Ajuda' }} />
    </Tabs>
  );
}

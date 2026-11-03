import { StatusBar } from 'expo-status-bar';
import { TemaProvider } from '../shared/tema/TemaProvider';
import { BoasVindasScreen } from '../features/boas-vindas/BoasVindasScreen';

export function App() {
  return (
    <TemaProvider>
      <BoasVindasScreen />
      <StatusBar style="auto" />
    </TemaProvider>
  );
}

/** Raiz: tema, sessão e guardas de rota. A agenda só existe para quem entrou. */
import { Stack } from 'expo-router';
import { TemaProvider } from '../shared/tema/TemaProvider';
import { ProvedorSessao, useSessao } from '../shared/sessao/ProvedorSessao';
import { ProvedorAgenda } from '../features/agenda/ProvedorAgenda';
import { EVENTO_SLUG } from '../shared/config';

function Rotas() {
  const { estado, requisitar, cofre } = useSessao();
  if (estado.tipo === 'carregando') return null;
  const logado = estado.tipo === 'logado';
  const pilha = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="entrar" />
      </Stack.Protected>
      <Stack.Protected guard={logado}>
        <Stack.Screen name="(abas)" />
        <Stack.Screen name="atividade/[id]" />
      </Stack.Protected>
    </Stack>
  );
  return logado ? <ProvedorAgenda slug={EVENTO_SLUG} requisitar={requisitar} cofre={cofre}>{pilha}</ProvedorAgenda> : pilha;
}

export default function Layout() {
  return (
    <TemaProvider>
      <ProvedorSessao>
        <Rotas />
      </ProvedorSessao>
    </TemaProvider>
  );
}

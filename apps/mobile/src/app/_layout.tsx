/** Raiz: tema, sessão e guardas de rota. Agenda, ingresso e inscrição só para quem entrou. */
import { useEffect, useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { TemaProvider } from '../shared/tema/TemaProvider';
import { ProvedorSessao, useSessao } from '../shared/sessao/ProvedorSessao';
import { ProvedorAgenda } from '../features/agenda/ProvedorAgenda';
import { ProvedorIngressos } from '../features/inscricao/ProvedorIngressos';
import { apiInscricao } from '../features/inscricao/api';
import { EVENTO_SLUG } from '../shared/config';
import { cofreArquivos } from '../shared/armazenamento/cofre';

function Rotas() {
  const { estado, requisitar, cofre, consumirDestino } = useSessao();
  const router = useRouter();
  const api = useMemo(() => apiInscricao(requisitar), [requisitar]);
  const logado = estado.tipo === 'logado';

  // Quem entrou para se inscrever volta direto para a inscrição.
  useEffect(() => {
    if (!logado) return;
    const destino = consumirDestino();
    if (destino) setTimeout(() => router.push(destino as Href), 0);
  }, [logado, consumirDestino, router]);

  if (estado.tipo === 'carregando') return null;
  const pilha = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={logado}>
        <Stack.Screen name="(abas)" />
        <Stack.Screen name="atividade/[id]" />
        <Stack.Screen name="inscricao/[slug]" />
        <Stack.Screen name="credenciamento" />
      </Stack.Protected>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="entrar" />
      </Stack.Protected>
      <Stack.Screen name="eventos" />
      <Stack.Screen name="evento/[slug]" />
      <Stack.Screen name="assistente" />
    </Stack>
  );
  if (!logado) return pilha;
  return (
    <ProvedorIngressos api={api} cofre={cofre}>
      <ProvedorAgenda slug={EVENTO_SLUG} requisitar={requisitar} cofre={cofre}>{pilha}</ProvedorAgenda>
    </ProvedorIngressos>
  );
}

export default function Layout() {
  return (
    <TemaProvider cofre={cofreArquivos}>
      <ProvedorSessao>
        <Rotas />
      </ProvedorSessao>
    </TemaProvider>
  );
}

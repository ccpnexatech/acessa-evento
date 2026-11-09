import { useMemo } from 'react';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TelaInscricao } from '../../features/inscricao/TelaInscricao';
import { apiInscricao } from '../../features/inscricao/api';
import { useIngressos } from '../../features/inscricao/ProvedorIngressos';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Inscricao() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { requisitar } = useSessao();
  const { adicionar } = useIngressos();
  const api = useMemo(() => apiInscricao(requisitar), [requisitar]);
  const router = useRouter();
  return (
    <TelaInscricao
      slug={String(slug)}
      api={api}
      gerarChave={randomUUID}
      onConcluido={adicionar}
      onVerIngresso={() => router.replace('/ingresso')}
      onCancelar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

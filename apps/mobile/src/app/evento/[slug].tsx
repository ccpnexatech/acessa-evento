import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TelaEvento } from '../../features/inscricao/telas-evento';
import { apiInscricao } from '../../features/inscricao/api';
import { useIngressosOpcional } from '../../features/inscricao/ProvedorIngressos';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Evento() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { estado, requisitar, lembrarDestino } = useSessao();
  const ingressos = useIngressosOpcional();
  const api = useMemo(() => apiInscricao(requisitar), [requisitar]);
  const router = useRouter();
  const s = String(slug);
  return (
    <TelaEvento
      slug={s}
      api={api}
      jaInscrito={Boolean(ingressos?.ingressos.some((i) => i.evento.slug === s))}
      onInscrever={() => {
        if (estado.tipo === 'logado') {
          router.push({ pathname: '/inscricao/[slug]', params: { slug: s } });
        } else {
          // Depois do código por e-mail, a pessoa volta direto para a inscrição.
          lembrarDestino(`/inscricao/${s}`);
          router.push('/entrar');
        }
      }}
      onVerIngresso={() => router.navigate('/ingresso')}
      onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { TelaEventos } from '../features/inscricao/telas-evento';
import { apiInscricao } from '../features/inscricao/api';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Eventos() {
  const { requisitar } = useSessao();
  const api = useMemo(() => apiInscricao(requisitar), [requisitar]);
  const router = useRouter();
  return <TelaEventos api={api} onAbrir={(slug) => router.push({ pathname: '/evento/[slug]', params: { slug } })} />;
}

import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiAreas } from '../../features/areas/api';
import { TelaHoje } from '../../features/areas/telas';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Hoje() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { requisitar } = useSessao();
  const router = useRouter();
  const api = useMemo(() => apiAreas(requisitar), [requisitar]);
  return <TelaHoje api={api} slug={slug} onLeitor={() => router.push(`/leitor/${slug}`)} onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/areas'))} />;
}

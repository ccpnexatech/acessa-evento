import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { apiAreas } from '../features/areas/api';
import { TelaAreas } from '../features/areas/telas';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Areas() {
  const { requisitar } = useSessao();
  const router = useRouter();
  const api = useMemo(() => apiAreas(requisitar), [requisitar]);
  return (
    <TelaAreas
      api={api}
      onHoje={(slug) => router.push(`/hoje/${slug}`)}
      onLeitor={(slug) => router.push(`/leitor/${slug}`)}
      onPortal={(id) => router.push(`/portal/${id}`)}
      onCredenciais={() => router.push('/credenciais')}
      onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/ajuda'))}
    />
  );
}

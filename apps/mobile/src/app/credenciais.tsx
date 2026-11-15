import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { apiAreas } from '../features/areas/api';
import { TelaCredenciais } from '../features/areas/telas';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Credenciais() {
  const { requisitar } = useSessao();
  const router = useRouter();
  const api = useMemo(() => apiAreas(requisitar), [requisitar]);
  return <TelaCredenciais api={api} onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/areas'))} />;
}

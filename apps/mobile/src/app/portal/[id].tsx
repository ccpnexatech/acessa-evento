import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiAreas } from '../../features/areas/api';
import { TelaPortal } from '../../features/areas/TelaPortal';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function PortalDoExpositor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requisitar } = useSessao();
  const router = useRouter();
  const api = useMemo(() => apiAreas(requisitar), [requisitar]);
  return <TelaPortal api={api} id={id} onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/areas'))} />;
}

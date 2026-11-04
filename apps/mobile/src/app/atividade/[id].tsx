import { useLocalSearchParams, useRouter } from 'expo-router';
import { TelaDetalhe } from '../../features/agenda/telas';

export default function Atividade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <TelaDetalhe atividadeId={String(id)} onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}

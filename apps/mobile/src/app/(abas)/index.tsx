import { useRouter } from 'expo-router';
import { TelaAgenda } from '../../features/agenda/telas';

export default function Agenda() {
  const router = useRouter();
  return <TelaAgenda onAbrir={(id) => router.push({ pathname: '/atividade/[id]', params: { id } })} />;
}

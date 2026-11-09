import { useRouter } from 'expo-router';
import { TelaIngressos } from '../../features/inscricao/TelaIngressos';
import { aumentarBrilho } from '../../shared/brilho';

export default function Ingresso() {
  const router = useRouter();
  return <TelaIngressos onVerEventos={() => router.push('/eventos')} aumentarBrilho={aumentarBrilho} />;
}

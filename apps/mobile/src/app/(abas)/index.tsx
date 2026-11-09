import { useRouter } from 'expo-router';
import { TelaAgenda } from '../../features/agenda/telas';
import { AtalhoIngresso } from '../../features/inscricao/AtalhoIngresso';
import { useIngressos } from '../../features/inscricao/ProvedorIngressos';
import { EVENTO_SLUG } from '../../shared/config';

export default function Agenda() {
  const router = useRouter();
  const { ingressos } = useIngressos();
  const ingresso = ingressos.find((i) => i.evento.slug === EVENTO_SLUG);
  return (
    <TelaAgenda
      onAbrir={(id) => router.push({ pathname: '/atividade/[id]', params: { id } })}
      topo={ingresso ? <AtalhoIngresso ingresso={ingresso} onMostrar={() => router.navigate('/ingresso')} /> : null}
    />
  );
}

import { useRouter } from 'expo-router';
import { TelaAjuda } from '../../features/ajuda/TelaAjuda';
import { eventosDaEquipe } from '../../features/credenciamento/equipe';
import { useCarga } from '../../shared/hooks/useCarga';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Ajuda() {
  const { estado, sair, requisitar, cofre } = useSessao();
  const router = useRouter();
  const equipe = useCarga(() => eventosDaEquipe(requisitar, cofre), [requisitar, cofre]);
  const nome = estado.tipo === 'logado' ? (estado.conta.nomeCracha ?? estado.conta.email) : '';
  return (
    <TelaAjuda
      nome={nome}
      onSair={() => void sair()}
      onVerEventos={() => router.push('/eventos')}
      onAssistente={() => router.push('/assistente')}
      {...(equipe.dados?.length ? { onCredenciamento: () => router.push('/credenciamento') } : {})}
    />
  );
}

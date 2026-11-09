import { useRouter } from 'expo-router';
import { TelaAjuda } from '../../features/ajuda/TelaAjuda';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Ajuda() {
  const { estado, sair } = useSessao();
  const router = useRouter();
  const nome = estado.tipo === 'logado' ? (estado.conta.nomeCracha ?? estado.conta.email) : '';
  return <TelaAjuda nome={nome} onSair={() => void sair()} onVerEventos={() => router.push('/eventos')} />;
}

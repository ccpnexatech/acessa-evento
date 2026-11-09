import { TelaAjuda } from '../../features/ajuda/TelaAjuda';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Ajuda() {
  const { estado, sair } = useSessao();
  const nome = estado.tipo === 'logado' ? (estado.conta.nomeCracha ?? estado.conta.email) : '';
  return <TelaAjuda nome={nome} onSair={() => void sair()} />;
}

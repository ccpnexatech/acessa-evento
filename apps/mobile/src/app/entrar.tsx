import { FluxoAcesso } from '../features/acesso/FluxoAcesso';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Entrar() {
  const { api, sessao, entrou } = useSessao();
  return <FluxoAcesso api={api} sessao={sessao} onPronto={entrou} />;
}

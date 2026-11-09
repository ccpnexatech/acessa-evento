import { useRouter } from 'expo-router';
import { FluxoAcesso } from '../features/acesso/FluxoAcesso';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Entrar() {
  const { api, sessao, entrou } = useSessao();
  const router = useRouter();
  return <FluxoAcesso api={api} sessao={sessao} onPronto={entrou} onExplorar={() => router.push('/eventos')} />;
}

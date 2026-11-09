import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ProvedorCredenciamento } from '../features/credenciamento/ProvedorCredenciamento';
import { FluxoCredenciamento } from '../features/credenciamento/FluxoCredenciamento';
import { LeitorCamera, vibrar } from '../features/credenciamento/adaptadores';
import { EVENTO_SLUG } from '../shared/config';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Credenciamento() {
  const { requisitar, cofre } = useSessao();
  const router = useRouter();
  return (
    <ProvedorCredenciamento slug={EVENTO_SLUG} requisitar={requisitar} cofre={cofre} gerarId={randomUUID}>
      <FluxoCredenciamento Leitor={LeitorCamera} vibrar={vibrar} onSair={() => (router.canGoBack() ? router.back() : router.replace('/ajuda'))} />
    </ProvedorCredenciamento>
  );
}

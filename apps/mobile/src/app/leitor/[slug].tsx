import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProvedorLeitor } from '../../features/acessos/ProvedorLeitor';
import { FluxoLeitor } from '../../features/acessos/FluxoLeitor';
import { LeitorCamera, vibrar } from '../../features/credenciamento/adaptadores';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Leitor() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { requisitar, cofre } = useSessao();
  const router = useRouter();
  return (
    <ProvedorLeitor slug={slug} requisitar={requisitar} cofre={cofre} gerarId={randomUUID}>
      <FluxoLeitor Leitor={LeitorCamera} vibrar={vibrar} onSair={() => (router.canGoBack() ? router.back() : router.replace('/areas'))} />
    </ProvedorLeitor>
  );
}

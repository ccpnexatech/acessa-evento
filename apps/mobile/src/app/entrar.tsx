import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { TelaAbertura } from '../features/abertura/TelaAbertura';
import { FluxoAcesso } from '../features/acesso/FluxoAcesso';
import { useSessao } from '../shared/sessao/ProvedorSessao';

/** A abertura aparece uma vez por aparelho; depois, vai direto para o acesso. */
const CHAVE = 'abertura-vista';

export default function Entrar() {
  const { api, sessao, entrou, cofre } = useSessao();
  const router = useRouter();
  const [vista, setVista] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    cofre.ler(CHAVE).then((v) => vivo && setVista(v === 'sim')).catch(() => vivo && setVista(true));
    return () => {
      vivo = false;
    };
  }, [cofre]);

  const marcar = () => {
    setVista(true);
    void cofre.gravar(CHAVE, 'sim').catch(() => undefined);
  };

  if (vista === null) return null;
  if (!vista) {
    return (
      <TelaAbertura
        onComecar={marcar}
        onExplorar={() => {
          marcar();
          router.push('/eventos');
        }}
      />
    );
  }
  return <FluxoAcesso api={api} sessao={sessao} onPronto={entrou} onExplorar={() => router.push('/eventos')} />;
}

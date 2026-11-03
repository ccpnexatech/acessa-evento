import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { TemaProvider } from '../shared/tema/TemaProvider';
import { criarClienteApi } from '../shared/api/cliente';
import { BoasVindasScreen } from '../features/boas-vindas/BoasVindasScreen';
import { FluxoAcesso } from '../features/acesso/FluxoAcesso';
import { apiAcesso } from '../features/acesso/api';
import type { ApiAcesso, Conta } from '../features/acesso/api';
import { sessaoSegura } from '../features/acesso/sessao';
import type { ArmazenamentoSessao } from '../features/acesso/sessao';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3333';

type Estado = { tipo: 'carregando' } | { tipo: 'anonimo' } | { tipo: 'logado'; conta: Conta };

interface Props {
  /** Injetáveis para teste; em produção usam a API real e o armazenamento seguro. */
  readonly api?: ApiAcesso;
  readonly sessao?: ArmazenamentoSessao;
}

export function App({ api: apiInjetada, sessao = sessaoSegura }: Props = {}) {
  const api = useMemo(
    () => apiInjetada ?? apiAcesso(criarClienteApi({ baseUrl: API_URL, obterToken: () => sessao.ler() })),
    [apiInjetada, sessao],
  );
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const token = await sessao.ler();
      if (!token) return vivo && setEstado({ tipo: 'anonimo' });
      try {
        const conta = await api.obterConta();
        if (vivo) setEstado(conta.primeiroAcessoPendente ? { tipo: 'anonimo' } : { tipo: 'logado', conta });
      } catch {
        await sessao.apagar();
        if (vivo) setEstado({ tipo: 'anonimo' });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [api, sessao]);

  const sair = async () => {
    await api.sair().catch(() => undefined);
    await sessao.apagar();
    setEstado({ tipo: 'anonimo' });
  };

  return (
    <TemaProvider>
      {estado.tipo === 'carregando' ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator accessibilityLabel="Carregando" />
        </View>
      ) : estado.tipo === 'anonimo' ? (
        <FluxoAcesso api={api} sessao={sessao} onPronto={(conta) => setEstado({ tipo: 'logado', conta })} />
      ) : (
        <BoasVindasScreen nome={estado.conta.nomeCracha} onSair={sair} />
      )}
      <StatusBar style="auto" />
    </TemaProvider>
  );
}

/** Componente registrado no Expo: sem props, usa a API real e o armazenamento seguro. */
export function Raiz() {
  return <App />;
}

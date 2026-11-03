/**
 * Máquina de estados do acesso: entrar → código → (primeiro acesso) → pronto.
 * Recebe a API e o armazenamento por parâmetro (injeção), para teste e troca.
 */
import { useState } from 'react';
import type { ApiAcesso, Conta } from './api';
import type { ArmazenamentoSessao } from './sessao';
import { TelaCodigo, TelaEntrar, TelaPrimeiroAcesso } from './telas';

export const VERSAO_TERMOS = '2026-11-03';

type Passo = { tipo: 'entrar' } | { tipo: 'codigo'; email: string } | { tipo: 'primeiro-acesso'; conta: Conta };

interface Props {
  readonly api: ApiAcesso;
  readonly sessao: ArmazenamentoSessao;
  readonly onPronto: (conta: Conta) => void;
}

export function FluxoAcesso({ api, sessao, onPronto }: Props) {
  const [passo, setPasso] = useState<Passo>({ tipo: 'entrar' });

  switch (passo.tipo) {
    case 'entrar':
      return (
        <TelaEntrar
          onPedirCodigo={async (email) => {
            await api.pedirCodigo(email);
            setPasso({ tipo: 'codigo', email });
          }}
        />
      );
    case 'codigo':
      return (
        <TelaCodigo
          email={passo.email}
          onVoltar={() => setPasso({ tipo: 'entrar' })}
          onReenviar={() => api.pedirCodigo(passo.email)}
          onEntrar={async (codigo) => {
            const r = await api.entrar(passo.email, codigo);
            await sessao.guardar(r.token);
            const conta = await api.obterConta();
            if (conta.primeiroAcessoPendente) setPasso({ tipo: 'primeiro-acesso', conta });
            else onPronto(conta);
          }}
        />
      );
    case 'primeiro-acesso':
      return (
        <TelaPrimeiroAcesso
          nomeInicial={passo.conta.nomeCracha ?? ''}
          onConcluir={async ({ nomeCracha, aceitaTermos }) => {
            onPronto(await api.concluirPrimeiroAcesso({ nomeCracha, aceitaTermos, versaoTermos: VERSAO_TERMOS }));
          }}
        />
      );
  }
}

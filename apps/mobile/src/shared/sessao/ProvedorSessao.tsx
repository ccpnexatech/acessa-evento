/**
 * Quem está usando o app e com quais serviços (API, armazenamento).
 * As rotas leem daqui; testes injetam versões falsas pelas props.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { criarClienteApi, criarRequisitor, ErroApi } from '../api/cliente';
import type { Requisitor } from '../api/cliente';
import { API_URL, EVENTO_SLUG } from '../config';
import { cofreArquivos, lerJson } from '../armazenamento/cofre';
import type { Cofre } from '../armazenamento/cofre';
import { apiAcesso } from '../../features/acesso/api';
import type { ApiAcesso, Conta } from '../../features/acesso/api';
import { sessaoSegura } from '../../features/acesso/sessao';
import type { ArmazenamentoSessao } from '../../features/acesso/sessao';

export type EstadoSessao = { readonly tipo: 'carregando' } | { readonly tipo: 'anonimo' } | { readonly tipo: 'logado'; readonly conta: Conta };

export interface ValorSessao {
  readonly estado: EstadoSessao;
  readonly api: ApiAcesso;
  readonly requisitar: Requisitor;
  readonly sessao: ArmazenamentoSessao;
  readonly cofre: Cofre;
  readonly entrou: (conta: Conta) => void;
  readonly sair: () => Promise<void>;
  /** Para onde voltar depois de entrar (ex.: a inscrição que pediu login). */
  readonly lembrarDestino: (rota: string | null) => void;
  readonly consumirDestino: () => string | null;
}

const CHAVE_CONTA = 'conta';
const Contexto = createContext<ValorSessao | null>(null);

interface Props {
  readonly children: ReactNode;
  readonly api?: ApiAcesso;
  readonly requisitar?: Requisitor;
  readonly sessao?: ArmazenamentoSessao;
  readonly cofre?: Cofre;
}

export function ProvedorSessao({ children, api: apiInjetada, requisitar: reqInjetado, sessao = sessaoSegura, cofre = cofreArquivos }: Props) {
  const requisitar = useMemo(() => reqInjetado ?? criarRequisitor({ baseUrl: API_URL, obterToken: () => sessao.ler() }), [reqInjetado, sessao]);
  const api = useMemo(() => apiInjetada ?? apiAcesso(criarClienteApi({ baseUrl: API_URL, obterToken: () => sessao.ler() })), [apiInjetada, sessao]);
  const [estado, setEstado] = useState<EstadoSessao>({ tipo: 'carregando' });
  const destino = useRef<string | null>(null);
  const lembrarDestino = useCallback((rota: string | null) => {
    destino.current = rota;
  }, []);
  const consumirDestino = useCallback(() => {
    const d = destino.current;
    destino.current = null;
    return d;
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const token = await sessao.ler();
      if (!token) {
        if (vivo) setEstado({ tipo: 'anonimo' });
        return;
      }
      try {
        const conta = await api.obterConta();
        if (!conta.primeiroAcessoPendente) await cofre.gravar(CHAVE_CONTA, JSON.stringify(conta));
        if (vivo) setEstado(conta.primeiroAcessoPendente ? { tipo: 'anonimo' } : { tipo: 'logado', conta });
      } catch (e) {
        // Sem internet, quem já entrou continua entrando: a agenda e o ingresso funcionam offline.
        if (e instanceof ErroApi && e.status === 0) {
          const salva = await lerJson<Conta>(cofre, CHAVE_CONTA);
          if (vivo) setEstado(salva ? { tipo: 'logado', conta: salva } : { tipo: 'anonimo' });
          return;
        }
        await sessao.apagar();
        await cofre.apagar(CHAVE_CONTA);
        if (vivo) setEstado({ tipo: 'anonimo' });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [api, sessao, cofre]);

  const entrou = useCallback((conta: Conta) => {
    setEstado({ tipo: 'logado', conta });
    void cofre.gravar(CHAVE_CONTA, JSON.stringify(conta));
  }, [cofre]);
  const sair = useCallback(async () => {
    await api.sair().catch(() => undefined);
    await sessao.apagar();
    await cofre.apagar(CHAVE_CONTA);
    await cofre.apagar(`favoritos-${EVENTO_SLUG}`);
    await cofre.apagar('ingressos');
    // A lista da equipe tem nomes e pedidos de acessibilidade: não fica no aparelho depois de sair.
    for (const chave of ['equipe-eventos', 'credenciamento-portao', `credenciamento-${EVENTO_SLUG}-pacote`, `credenciamento-${EVENTO_SLUG}-fila`]) {
      await cofre.apagar(chave);
    }
    setEstado({ tipo: 'anonimo' });
  }, [api, sessao, cofre]);

  const valor = useMemo(
    () => ({ estado, api, requisitar, sessao, cofre, entrou, sair, lembrarDestino, consumirDestino }),
    [estado, api, requisitar, sessao, cofre, entrou, sair, lembrarDestino, consumirDestino],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ValorSessao {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.');
  return v;
}

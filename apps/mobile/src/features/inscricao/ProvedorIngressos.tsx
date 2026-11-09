/**
 * Ingressos da pessoa, guardados no aparelho: a aba Ingresso abre sem internet.
 * Sincroniza ao abrir e ao voltar para o app; uma inscrição nova entra na hora.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import type { ApiInscricao } from './api';
import type { Ingresso } from './modelo';

export const CHAVE_INGRESSOS = 'ingressos';

export interface ValorIngressos {
  readonly ingressos: readonly Ingresso[];
  readonly carregando: boolean;
  readonly offline: boolean;
  readonly adicionar: (i: Ingresso) => void;
  readonly atualizar: () => Promise<void>;
}

const Contexto = createContext<ValorIngressos | null>(null);

export function ProvedorIngressos({ api, cofre, children }: { api: ApiInscricao; cofre: Cofre; children: ReactNode }) {
  const [ingressos, setIngressos] = useState<readonly Ingresso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [offline, setOffline] = useState(false);

  const guardar = useCallback((lista: readonly Ingresso[]) => {
    setIngressos(lista);
    void cofre.gravar(CHAVE_INGRESSOS, JSON.stringify(lista)).catch(() => undefined);
  }, [cofre]);

  const atualizar = useCallback(async () => {
    try {
      guardar(await api.ingressos());
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setCarregando(false);
    }
  }, [api, guardar]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const salvos = await lerJson<Ingresso[]>(cofre, CHAVE_INGRESSOS);
      if (vivo && salvos) {
        setIngressos(salvos);
        setCarregando(false);
      }
      if (vivo) await atualizar();
    })();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void atualizar();
    });
    return () => {
      vivo = false;
      app.remove();
    };
  }, [cofre, atualizar]);

  const adicionar = useCallback((i: Ingresso) => {
    setIngressos((atual) => {
      const lista = [...atual.filter((x) => x.id !== i.id), i];
      void cofre.gravar(CHAVE_INGRESSOS, JSON.stringify(lista)).catch(() => undefined);
      return lista;
    });
  }, [cofre]);

  const valor = useMemo(() => ({ ingressos, carregando, offline, adicionar, atualizar }), [ingressos, carregando, offline, adicionar, atualizar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIngressos(): ValorIngressos {
  const v = useContext(Contexto);
  if (!v) throw new Error('useIngressos precisa estar dentro de <ProvedorIngressos>.');
  return v;
}

/** Para telas abertas também sem login: null quando ninguém entrou. */
export function useIngressosOpcional(): ValorIngressos | null {
  return useContext(Contexto);
}

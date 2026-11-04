/**
 * Estado da agenda compartilhado entre a lista e o detalhe.
 * Abre com o que está salvo, sincroniza ao abrir, ao voltar para o app e,
 * sem rede, tenta de novo a cada 30 s.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Requisitor } from '../../shared/api/cliente';
import type { Cofre } from '../../shared/armazenamento/cofre';
import { AgendaOffline, FavoritosOffline, semConexao } from './sincronizacao';
import type { Agenda } from './modelo';

export type Conexao = 'online' | 'offline' | 'sincronizando';

export interface ValorAgenda {
  readonly agenda: Agenda | null;
  readonly carregando: boolean;
  readonly conexao: Conexao;
  readonly erro: string | null;
  readonly favoritas: ReadonlySet<string>;
  readonly pendentes: number;
  readonly alternarFavorita: (atividadeId: string) => Promise<void>;
  readonly atualizar: () => Promise<void>;
}

const Contexto = createContext<ValorAgenda | null>(null);
const NOVA_TENTATIVA_MS = 30_000;

interface Props {
  readonly slug: string;
  readonly requisitar: Requisitor;
  readonly cofre: Cofre;
  readonly children: ReactNode;
}

export function ProvedorAgenda({ slug, requisitar, cofre, children }: Props) {
  const agendaOffline = useMemo(() => new AgendaOffline(requisitar, cofre), [requisitar, cofre]);
  const favoritos = useMemo(() => new FavoritosOffline(requisitar, cofre, slug), [requisitar, cofre, slug]);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [conexao, setConexao] = useState<Conexao>('sincronizando');
  const [erro, setErro] = useState<string | null>(null);
  const [favoritas, setFavoritas] = useState<ReadonlySet<string>>(new Set());
  const [pendentes, setPendentes] = useState(0);
  const vivo = useRef(true);

  const atualizar = useCallback(async () => {
    setConexao('sincronizando');
    try {
      const nova = await agendaOffline.sincronizar(slug);
      if (!vivo.current) return;
      setAgenda(nova.agenda);
      setErro(null);
      setFavoritas(await favoritos.sincronizar().catch(() => favoritos.carregar()));
      setPendentes(favoritos.pendentes);
      setConexao(favoritos.pendentes ? 'offline' : 'online');
    } catch (e) {
      if (!vivo.current) return;
      setConexao('offline');
      if (!semConexao(e)) setErro(e instanceof Error ? e.message : 'Não foi possível atualizar a agenda.');
    } finally {
      if (vivo.current) setCarregando(false);
    }
  }, [agendaOffline, favoritos, slug]);

  useEffect(() => {
    vivo.current = true;
    void (async () => {
      const [salva, favs] = await Promise.all([agendaOffline.salva(slug), favoritos.carregar()]);
      if (!vivo.current) return;
      if (salva) {
        setAgenda(salva.agenda);
        setCarregando(false);
      }
      setFavoritas(favs);
      setPendentes(favoritos.pendentes);
      await atualizar();
    })();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void atualizar();
    });
    return () => {
      vivo.current = false;
      app.remove();
    };
  }, [agendaOffline, favoritos, slug, atualizar]);

  useEffect(() => {
    if (conexao !== 'offline') return undefined;
    const t = setInterval(() => void atualizar(), NOVA_TENTATIVA_MS);
    return () => clearInterval(t);
  }, [conexao, atualizar]);

  const alternarFavorita = useCallback(async (id: string) => {
    setFavoritas(await favoritos.alternar(id));
    setPendentes(favoritos.pendentes);
    try {
      setFavoritas(await favoritos.sincronizar());
      setPendentes(0);
    } catch {
      setPendentes(favoritos.pendentes);
      setConexao('offline');
    }
  }, [favoritos]);

  const valor = useMemo<ValorAgenda>(
    () => ({ agenda, carregando, conexao, erro, favoritas, pendentes, alternarFavorita, atualizar }),
    [agenda, carregando, conexao, erro, favoritas, pendentes, alternarFavorita, atualizar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAgenda(): ValorAgenda {
  const v = useContext(Contexto);
  if (!v) throw new Error('useAgenda precisa estar dentro de <ProvedorAgenda>.');
  return v;
}

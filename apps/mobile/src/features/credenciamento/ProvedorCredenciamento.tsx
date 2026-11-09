/**
 * Estado do aparelho da equipe: pacote do evento (lista + chaves públicas),
 * portão, fila de check-ins e sincronização. Tudo funciona sem internet
 * depois que o pacote foi baixado uma vez.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Requisitor } from '../../shared/api/cliente';
import { ErroApi } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import { FilaCheckins, semConexao } from './fila';
import { avaliarIngresso, avaliarLeitura } from './modelo';
import type { Pacote, Resultado } from './modelo';
import { verificadorNoble } from './verificador';

export type ConexaoEquipe = 'online' | 'offline' | 'sincronizando';

export interface ValorCredenciamento {
  readonly pacote: Pacote | null;
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly conexao: ConexaoEquipe;
  readonly naFila: number;
  readonly portao: string;
  readonly definirPortao: (p: string) => void;
  readonly baixarPacote: () => Promise<void>;
  readonly sincronizar: () => Promise<void>;
  /** Lê um QR: decide offline e, se válido, põe o check-in na fila. */
  readonly ler: (texto: string) => Promise<Resultado>;
  /** Check-in manual depois de conferir documento com foto. */
  readonly checkinManual: (ingressoId: string) => Promise<Resultado>;
}

const Contexto = createContext<ValorCredenciamento | null>(null);
const CHAVE_PORTAO = 'credenciamento-portao';
const NOVA_TENTATIVA_MS = 30_000;

interface Props {
  readonly slug: string;
  readonly requisitar: Requisitor;
  readonly cofre: Cofre;
  readonly gerarId: () => string;
  readonly agora?: () => number;
  readonly children: ReactNode;
}

export function ProvedorCredenciamento({ slug, requisitar, cofre, gerarId, agora = Date.now, children }: Props) {
  const chavePacote = `credenciamento-${slug}-pacote`;
  const fila = useMemo(() => new FilaCheckins(cofre, slug), [cofre, slug]);
  const [pacote, setPacote] = useState<Pacote | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [conexao, setConexao] = useState<ConexaoEquipe>('sincronizando');
  const [naFila, setNaFila] = useState(0);
  const [portao, setPortao] = useState('Portão 1');
  const sincronizando = useRef(false);
  const verificador = useMemo(() => verificadorNoble(pacote?.chaves ?? []), [pacote]);

  const sincronizar = useCallback(async () => {
    if (sincronizando.current) return;
    sincronizando.current = true;
    if (fila.pendentes.length) setConexao('sincronizando');
    try {
      await fila.sincronizar(requisitar, slug);
      setConexao('online');
      setErro(null);
    } catch (e) {
      setConexao('offline');
      if (!semConexao(e)) setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar os check-ins.');
    } finally {
      setNaFila(fila.pendentes.length);
      sincronizando.current = false;
    }
  }, [fila, requisitar, slug]);

  const baixarPacote = useCallback(async () => {
    try {
      const r = await requisitar<Pacote>('GET', `/credenciamento/${encodeURIComponent(slug)}/pacote`);
      if (!r.dados) throw new Error('Resposta vazia do servidor.');
      setPacote(r.dados);
      setErro(null);
      setConexao('online');
      await cofre.gravar(chavePacote, JSON.stringify(r.dados));
    } catch (e) {
      if (semConexao(e)) setConexao('offline');
      else setErro(e instanceof Error ? e.message : 'Não foi possível baixar a lista.');
    } finally {
      setCarregando(false);
    }
  }, [requisitar, slug, cofre, chavePacote]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [salvo, portaoSalvo] = await Promise.all([lerJson<Pacote>(cofre, chavePacote), cofre.ler(CHAVE_PORTAO), fila.carregar()]);
      if (!vivo) return;
      if (salvo) {
        setPacote(salvo);
        setCarregando(false);
      }
      if (portaoSalvo) setPortao(portaoSalvo);
      setNaFila(fila.pendentes.length);
      // Envia o que ficou na fila antes de baixar a lista nova, para ela já vir com esses check-ins.
      await sincronizar();
      await baixarPacote();
    })();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void sincronizar();
    });
    return () => {
      vivo = false;
      app.remove();
    };
  }, [cofre, chavePacote, fila, sincronizar, baixarPacote]);

  useEffect(() => {
    if (!naFila || conexao !== 'offline') return undefined;
    const t = setInterval(() => void sincronizar(), NOVA_TENTATIVA_MS);
    return () => clearInterval(t);
  }, [naFila, conexao, sincronizar]);

  const definirPortao = useCallback((p: string) => {
    setPortao(p);
    void cofre.gravar(CHAVE_PORTAO, p).catch(() => undefined);
  }, [cofre]);

  const registrar = useCallback(async (ingressoId: string, metodo: 'qr' | 'manual') => {
    await fila.adicionar({
      id: gerarId(),
      ingressoId,
      portao: portao.trim() || 'Portão 1',
      metodo,
      feitoEm: new Date(agora()).toISOString(),
      ...(metodo === 'manual' ? { documentoConferido: true as const } : {}),
    });
    setNaFila(fila.pendentes.length);
    void sincronizar();
  }, [fila, gerarId, portao, agora, sincronizar]);

  const ler = useCallback(async (texto: string): Promise<Resultado> => {
    if (!pacote) return { tipo: 'invalido', motivo: 'formato' };
    const r = avaliarLeitura(texto, pacote, verificador, fila.feitos, agora());
    if (r.tipo === 'valido') await registrar(r.ingressoId, 'qr');
    return r;
  }, [pacote, verificador, fila, agora, registrar]);

  const checkinManual = useCallback(async (ingressoId: string): Promise<Resultado> => {
    if (!pacote) return { tipo: 'invalido', motivo: 'formato' };
    const r = avaliarIngresso(ingressoId, pacote, fila.feitos);
    if (r.tipo === 'valido') await registrar(ingressoId, 'manual');
    return r;
  }, [pacote, fila, registrar]);

  const valor = useMemo<ValorCredenciamento>(
    () => ({ pacote, carregando, erro, conexao, naFila, portao, definirPortao, baixarPacote, sincronizar, ler, checkinManual }),
    [pacote, carregando, erro, conexao, naFila, portao, definirPortao, baixarPacote, sincronizar, ler, checkinManual],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCredenciamento(): ValorCredenciamento {
  const v = useContext(Contexto);
  if (!v) throw new Error('useCredenciamento precisa estar dentro de <ProvedorCredenciamento>.');
  return v;
}

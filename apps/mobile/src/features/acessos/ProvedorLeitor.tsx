/**
 * Estado do leitor por ponto: pacote do evento, ponto escolhido, fila de
 * leituras e sincronização. Depois do primeiro pacote, tudo funciona sem internet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Requisitor } from '../../shared/api/cliente';
import { ErroApi } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import { semConexao } from '../credenciamento/fila';
import { verificadorNoble } from '../credenciamento/verificador';
import { FilaLeituras } from './fila';
import { avaliarCredencial, avaliarLeitura } from './leitor';
import type { Credencial, PacoteAcessos, Ponto, ResultadoLeitura } from './leitor';

export interface ValorLeitor {
  readonly pacote: PacoteAcessos | null;
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly conexao: 'online' | 'offline' | 'sincronizando';
  readonly naFila: number;
  readonly ponto: Ponto | null;
  readonly escolherPonto: (id: string) => void;
  readonly atualizar: () => Promise<void>;
  /** Lê um QR, decide sem internet e põe a leitura (liberada ou barrada) na fila. */
  readonly ler: (texto: string) => Promise<ResultadoLeitura>;
  /** Liberação à mão, depois de conferir documento com foto. */
  readonly liberarManual: (credencial: Credencial) => Promise<ResultadoLeitura>;
  /** Marca a meia-entrada como conferida ou não apresentada (precisa de internet). */
  readonly conferirMeia: (meiaId: string, resultado: 'confirmada' | 'recusada') => Promise<string | null>;
}

const Contexto = createContext<ValorLeitor | null>(null);
const NOVA_TENTATIVA_MS = 30_000;

interface Props {
  readonly slug: string;
  readonly requisitar: Requisitor;
  readonly cofre: Cofre;
  readonly gerarId: () => string;
  readonly agora?: () => number;
  readonly children: ReactNode;
}

export function ProvedorLeitor({ slug, requisitar, cofre, gerarId, agora = Date.now, children }: Props) {
  const chavePacote = `acessos-${slug}-pacote`;
  const chavePonto = `acessos-${slug}-ponto`;
  const fila = useMemo(() => new FilaLeituras(cofre, slug), [cofre, slug]);
  const [pacote, setPacote] = useState<PacoteAcessos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [conexao, setConexao] = useState<ValorLeitor['conexao']>('sincronizando');
  const [naFila, setNaFila] = useState(0);
  const [pontoId, setPontoId] = useState<string | null>(null);
  const ocupado = useRef(false);
  const verificador = useMemo(() => verificadorNoble(pacote?.chaves ?? []), [pacote]);
  const ponto = useMemo(() => pacote?.pontos.find((p) => p.id === pontoId) ?? null, [pacote, pontoId]);

  const enviar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    if (fila.pendentes.length) setConexao('sincronizando');
    try {
      await fila.sincronizar(requisitar, slug);
      setConexao('online');
      setErro(null);
    } catch (e) {
      setConexao('offline');
      if (!semConexao(e)) setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar as leituras.');
    } finally {
      setNaFila(fila.pendentes.length);
      ocupado.current = false;
    }
  }, [fila, requisitar, slug]);

  const baixar = useCallback(async () => {
    try {
      const r = await requisitar<PacoteAcessos>('GET', `/acessos/${encodeURIComponent(slug)}/pacote`);
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

  // Primeiro o que ficou na fila, depois a lista nova: assim ela já vem com essas leituras.
  const atualizar = useCallback(async () => {
    await enviar();
    await baixar();
  }, [enviar, baixar]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [salvo, pontoSalvo] = await Promise.all([lerJson<PacoteAcessos>(cofre, chavePacote), cofre.ler(chavePonto), fila.carregar()]);
      if (!vivo) return;
      if (salvo) {
        setPacote(salvo);
        setCarregando(false);
      }
      if (pontoSalvo) setPontoId(pontoSalvo);
      setNaFila(fila.pendentes.length);
      await atualizar();
    })();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void enviar();
    });
    return () => {
      vivo = false;
      app.remove();
    };
  }, [cofre, chavePacote, chavePonto, fila, atualizar, enviar]);

  useEffect(() => {
    if (!naFila || conexao !== 'offline') return undefined;
    const t = setInterval(() => void enviar(), NOVA_TENTATIVA_MS);
    return () => clearInterval(t);
  }, [naFila, conexao, enviar]);

  const escolherPonto = useCallback((id: string) => {
    setPontoId(id);
    void cofre.gravar(chavePonto, id).catch(() => undefined);
  }, [cofre, chavePonto]);

  const registrar = useCallback(async (r: ResultadoLeitura, metodo: 'qr' | 'manual') => {
    // "Já entrou" e QR inválido não viram leitura; liberada e barrada, sim: a organização vê onde a regra atrapalha.
    if (!ponto || (r.tipo !== 'liberado' && r.tipo !== 'negado')) return r;
    await fila.adicionar({
      id: gerarId(), credencialId: r.credencial.id, pontoId: ponto.id, sentido: 'entrada',
      resultado: r.tipo === 'liberado' ? 'liberado' : 'negado', metodo, feitoEm: new Date(agora()).toISOString(),
      ...(metodo === 'manual' && r.tipo === 'liberado' ? { documentoConferido: true as const } : {}),
    });
    setNaFila(fila.pendentes.length);
    void enviar();
    return r;
  }, [ponto, fila, gerarId, agora, enviar]);

  const ler = useCallback(async (texto: string): Promise<ResultadoLeitura> => {
    if (!pacote || !ponto) return { tipo: 'invalido', motivo: 'formato' };
    return registrar(avaliarLeitura(texto, ponto, pacote, verificador, fila.feitas, agora()), 'qr');
  }, [pacote, ponto, verificador, fila, agora, registrar]);

  const liberarManual = useCallback(async (credencial: Credencial): Promise<ResultadoLeitura> => {
    if (!pacote || !ponto) return { tipo: 'invalido', motivo: 'formato' };
    return registrar(avaliarCredencial(credencial, ponto, pacote, fila.feitas, agora()), 'manual');
  }, [pacote, ponto, fila, agora, registrar]);

  const conferirMeia = useCallback(async (meiaId: string, resultado: 'confirmada' | 'recusada'): Promise<string | null> => {
    try {
      await requisitar('POST', `/acessos/${encodeURIComponent(slug)}/meias/${meiaId}/conferir`, { corpo: { resultado } });
      setPacote((p) => (p ? { ...p, meias: p.meias.map((m) => (m.id === meiaId ? { ...m, resultado } : m)) } : p));
      return null;
    } catch (e) {
      return semConexao(e) ? 'Sem internet: a conferência não foi registrada. Anote e registre quando a conexão voltar.' : e instanceof Error ? e.message : 'Não foi possível registrar.';
    }
  }, [requisitar, slug]);

  const valor = useMemo<ValorLeitor>(
    () => ({ pacote, carregando, erro, conexao, naFila, ponto, escolherPonto, atualizar, ler, liberarManual, conferirMeia }),
    [pacote, carregando, erro, conexao, naFila, ponto, escolherPonto, atualizar, ler, liberarManual, conferirMeia],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useLeitor(): ValorLeitor {
  const v = useContext(Contexto);
  if (!v) throw new Error('useLeitor precisa estar dentro de <ProvedorLeitor>.');
  return v;
}

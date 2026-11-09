/** Dados e API falsa compartilhados pelos testes da inscrição. */
import { ErroApi } from '../../shared/api/cliente';
import type { ApiInscricao, PedidoInscricao } from './api';
import type { DetalheEvento, Ingresso } from './modelo';

export const EVENTO: DetalheEvento = {
  id: 'e1', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Centro de Eventos do Ceará',
  fuso: 'America/Fortaleza', descricao: 'Congresso de turismo.', inscricoesAbertas: true,
  recursosOferecidos: ['libras', 'legenda'],
  destaques: [{ titulo: 'Abertura', inicio: '2026-07-01T12:00:00Z' }],
  tipos: [
    { id: 't1', nome: 'Congressista', descricao: 'Os três dias.', precoCentavos: 45000, esgotado: false },
    { id: 't3', nome: 'Um dia', descricao: null, precoCentavos: 12000, esgotado: true },
  ],
};

export const INGRESSO: Ingresso = {
  id: 'i1', tipo: 'Congressista', nome: 'Caio Ponte', emitidoEm: '2026-11-09T12:00:00Z', qr: 'AE1.conteudo.assinatura', checkin: null,
  evento: { slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Centro de Eventos do Ceará' },
};

export type Chamada = { slug: string; chave: string; pedido: PedidoInscricao };

export function apiFalsa(responder: (c: Chamada) => Ingresso | Error = () => INGRESSO, parcial: Partial<ApiInscricao> = {}) {
  const chamadas: Chamada[] = [];
  const api: ApiInscricao = {
    eventos: jest.fn(async (recurso) => (recurso === 'libras' ? [EVENTO] : [EVENTO, { ...EVENTO, id: 'e2', slug: 'outro', nome: 'Outro evento', recursosOferecidos: [] }])),
    evento: jest.fn(async () => EVENTO),
    inscrever: jest.fn(async (slug, chave, pedido) => {
      chamadas.push({ slug, chave, pedido });
      const r = responder({ slug, chave, pedido });
      if (r instanceof Error) throw r;
      return r;
    }),
    ingressos: jest.fn(async () => [INGRESSO]),
    ...parcial,
  };
  return { api, chamadas };
}

export const semRede = () => new ErroApi(0, 'sem_conexao', 'Sem internet.');
export const recusado = () => new ErroApi(402, 'pagamento_recusado', 'Pagamento não aprovado. Tente outro cartão ou pague com Pix.');

/** Chamadas da inscrição sobre o Requisitor compartilhado. */
import type { Requisitor } from '../../shared/api/cliente';
import type { DetalheEvento, Ingresso, Metodo, RecursoEvento, RecursoPedido, ResumoEvento } from './modelo';

export interface PedidoInscricao {
  readonly tipoIngressoId: string;
  readonly recursos: readonly RecursoPedido[];
  readonly metodo: Metodo;
  readonly cartao?: { readonly numero: string };
}

export interface ApiInscricao {
  eventos(recurso?: RecursoEvento): Promise<ResumoEvento[]>;
  evento(slug: string): Promise<DetalheEvento>;
  /** A mesma chave em toda nova tentativa do mesmo pagamento: o servidor não cobra duas vezes. */
  inscrever(slug: string, chave: string, pedido: PedidoInscricao): Promise<Ingresso>;
  ingressos(): Promise<Ingresso[]>;
}

const exigir = <T>(dados: T | undefined): T => {
  if (dados === undefined) throw new Error('Resposta vazia do servidor.');
  return dados;
};

export function apiInscricao(requisitar: Requisitor): ApiInscricao {
  return {
    async eventos(recurso) {
      const r = await requisitar<{ eventos: ResumoEvento[] }>('GET', `/eventos${recurso ? `?recurso=${recurso}` : ''}`);
      return exigir(r.dados).eventos;
    },
    async evento(slug) {
      return exigir((await requisitar<DetalheEvento>('GET', `/eventos/${encodeURIComponent(slug)}`)).dados);
    },
    async inscrever(slug, chave, pedido) {
      const r = await requisitar<{ ingresso: Ingresso }>('POST', `/eventos/${encodeURIComponent(slug)}/inscricoes`, {
        corpo: pedido,
        cabecalhos: { 'idempotency-key': chave },
      });
      return exigir(r.dados).ingresso;
    },
    async ingressos() {
      return exigir((await requisitar<{ ingressos: Ingresso[] }>('GET', '/ingressos')).dados).ingressos;
    },
  };
}

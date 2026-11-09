/**
 * Casos de uso da inscrição: descobrir eventos, inscrever-se e pagar.
 *
 * A cobrança é idempotente pela chave que o app manda (Idempotency-Key):
 * repetir a mesma chave nunca cria outro pedido nem outra cobrança. Se a
 * rede cai no meio, o pedido fica pendente e a próxima tentativa com a
 * mesma chave consulta o provedor com essa chave e conclui (feature 02,
 * "Não cobrar duas vezes").
 */
import { ErroInscricao, dataExpurgo, filtroRecurso, validarChave, validarInscricao, validarSlug } from '../domain/inscricao.ts';
import type { DetalheEvento, Ingresso, IngressoSalvo, Metodo, Pedido, RecursoPedido, ResumoEvento, StatusPedido } from '../domain/inscricao.ts';
import { emitirToken, validadeDoEvento } from '../../../shared/qr/token.ts';
import type { Assinador } from '../../../shared/qr/token.ts';

export interface NovaReserva {
  readonly eventoId: string;
  readonly tipoIngressoId: string;
  readonly valorCentavos: number;
  readonly metodo: Metodo;
  readonly chave: string;
  readonly cartaoFinal: string | null;
  readonly recursos: readonly RecursoPedido[];
  readonly apagarAcessibilidadeApos: string;
}

export interface RepositorioInscricao {
  eventos(recurso: string | null): Promise<ResumoEvento[]>;
  evento(slug: string, pessoaId: string | null): Promise<DetalheEvento | null>;
  pedidoPorChave(pessoaId: string, chave: string): Promise<Pedido | null>;
  temIngresso(pessoaId: string, eventoId: string): Promise<boolean>;
  /** Prende uma vaga e cria o pedido pendente; 'esgotado' quando não há vaga. */
  reservar(pessoaId: string, r: NovaReserva): Promise<Pedido | 'esgotado'>;
  /** Grava o resultado; aprovado emite o ingresso, recusado devolve a vaga. */
  concluir(pessoaId: string, pedidoId: string, status: Exclude<StatusPedido, 'pendente'>, referencia: string): Promise<IngressoSalvo | null>;
  ingressoDoPedido(pessoaId: string, pedidoId: string): Promise<IngressoSalvo | null>;
  ingressos(pessoaId: string): Promise<IngressoSalvo[]>;
}

export interface Cobranca {
  /** A mesma chave devolve o mesmo resultado no provedor. */
  readonly chave: string;
  readonly valorCentavos: number;
  readonly metodo: Metodo;
  readonly cartao: { readonly numero: string } | null;
  readonly descricao: string;
}

/** Porta do provedor de pagamento (ADR 0007). Erro lançado = não sabemos o resultado. */
export interface ProvedorPagamento {
  cobrar(c: Cobranca): Promise<{ readonly aprovado: boolean; readonly referencia: string }>;
}

export interface Recibo {
  readonly evento: string;
  readonly tipo: string;
  readonly valorCentavos: number;
  readonly metodo: Metodo;
  readonly pedidoId: string;
}

export interface NotificadorInscricao {
  recibo(pessoaId: string, recibo: Recibo): Promise<void>;
}

export interface AuditoriaInscricao {
  registrar(e: { atorId: string | null; acao: string; dados?: Record<string, unknown> }): Promise<void>;
}

export interface DependenciasInscricao {
  readonly repositorio: RepositorioInscricao;
  readonly pagamento: ProvedorPagamento;
  readonly notificador: NotificadorInscricao;
  readonly auditoria: AuditoriaInscricao;
  /** Assina o QR do ingresso (ADR 0006). */
  readonly assinador: Assinador;
}

export interface ResultadoInscricao {
  readonly pedido: Pedido;
  readonly ingresso: Ingresso;
  /** false quando a chave já tinha sido usada e devolvemos o mesmo resultado. */
  readonly novo: boolean;
}

const RECUSADO = 'Pagamento não aprovado. Tente outro cartão ou pague com Pix.';

export class InscricaoServico {
  readonly #d: DependenciasInscricao;

  constructor(d: DependenciasInscricao) {
    this.#d = d;
  }

  eventos(recurso: string | null): Promise<ResumoEvento[]> {
    return this.#d.repositorio.eventos(filtroRecurso(recurso));
  }

  async evento(slug: string, pessoaId: string | null): Promise<DetalheEvento> {
    const e = await this.#d.repositorio.evento(validarSlug(slug), pessoaId);
    if (!e) throw new ErroInscricao('evento_inexistente', 'Evento não encontrado.');
    return e;
  }

  async ingressos(pessoaId: string): Promise<Ingresso[]> {
    return (await this.#d.repositorio.ingressos(pessoaId)).map((i) => this.#comQr(i));
  }

  #comQr({ eventoId, ...i }: IngressoSalvo): Ingresso {
    return { ...i, qr: emitirToken({ i: i.id, e: eventoId, x: validadeDoEvento(i.evento.fim) }, this.#d.assinador) };
  }

  async inscrever(pessoaId: string, slug: string, chaveBruta: string | undefined, corpo: unknown): Promise<ResultadoInscricao> {
    const chave = validarChave(chaveBruta);
    const dados = validarInscricao(corpo);
    const repo = this.#d.repositorio;

    const anterior = await repo.pedidoPorChave(pessoaId, chave);
    if (anterior?.status === 'recusado') throw new ErroInscricao('pagamento_recusado', RECUSADO);
    if (anterior?.status === 'aprovado') {
      const ingresso = await repo.ingressoDoPedido(pessoaId, anterior.id);
      if (ingresso) return { pedido: anterior, ingresso: this.#comQr(ingresso), novo: false };
    }

    const evento = await this.evento(slug, pessoaId);
    const tipo = evento.tipos.find((t) => t.id === dados.tipoIngressoId);
    if (!tipo) throw new ErroInscricao('tipo_inexistente', 'Tipo de ingresso não encontrado.', 'tipoIngressoId');

    let pedido = anterior;
    if (!pedido) {
      if (!evento.inscricoesAbertas) throw new ErroInscricao('inscricoes_fechadas', 'As inscrições deste evento estão fechadas.');
      if (await repo.temIngresso(pessoaId, evento.id)) throw new ErroInscricao('ja_inscrito', `Você já está no ${evento.nome}.`);
      const reserva = await repo.reservar(pessoaId, {
        eventoId: evento.id,
        tipoIngressoId: tipo.id,
        valorCentavos: tipo.precoCentavos,
        metodo: dados.metodo,
        chave,
        cartaoFinal: dados.cartao ? dados.cartao.numero.slice(-4) : null,
        recursos: dados.recursos,
        apagarAcessibilidadeApos: dataExpurgo(evento.fim),
      });
      if (reserva === 'esgotado') throw new ErroInscricao('esgotado', `O ingresso "${tipo.nome}" esgotou.`, 'tipoIngressoId');
      pedido = reserva;
    }

    // Se o provedor falhar aqui, o pedido segue pendente e a vaga presa: a mesma chave retoma daqui.
    const cobranca = await this.#d.pagamento.cobrar({
      chave,
      valorCentavos: pedido.valorCentavos,
      metodo: pedido.metodo,
      cartao: dados.cartao,
      descricao: `${evento.nome} · ${tipo.nome}`,
    });

    if (!cobranca.aprovado) {
      await repo.concluir(pessoaId, pedido.id, 'recusado', cobranca.referencia);
      await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'pagamento.recusado', dados: { pedidoId: pedido.id, metodo: pedido.metodo } });
      throw new ErroInscricao('pagamento_recusado', RECUSADO);
    }

    const ingresso = await repo.concluir(pessoaId, pedido.id, 'aprovado', cobranca.referencia);
    if (!ingresso) throw new Error('Pedido aprovado sem ingresso emitido.');
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'inscricao.concluida', dados: { pedidoId: pedido.id, ingressoId: ingresso.id } });
    // Recibo é cortesia: falha no e-mail não desfaz a inscrição.
    await this.#d.notificador
      .recibo(pessoaId, { evento: evento.nome, tipo: tipo.nome, valorCentavos: pedido.valorCentavos, metodo: pedido.metodo, pedidoId: pedido.id })
      .catch(() => undefined);
    return { pedido: { ...pedido, status: 'aprovado' }, ingresso: this.#comQr(ingresso), novo: true };
  }
}

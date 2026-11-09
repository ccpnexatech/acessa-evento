/** Casos de uso do credenciamento: pacote offline da equipe e sincronização da fila. */
import { ErroCredenciamento, validarLote } from '../domain/credenciamento.ts';
import type { CheckinEnviado, EventoEquipe, Participante, Situacao } from '../domain/credenciamento.ts';

export interface RepositorioCredenciamento {
  evento(pessoaId: string, slug: string): Promise<EventoEquipe | null>;
  eDaEquipe(pessoaId: string, eventoId: string): Promise<boolean>;
  eventosDaEquipe(pessoaId: string): Promise<EventoEquipe[]>;
  participantes(pessoaId: string, eventoId: string): Promise<Participante[]>;
  /** Grava o que ainda não existe e devolve a situação de cada check-in enviado (ignora ingresso de outro evento). */
  registrar(pessoaId: string, eventoId: string, checkins: readonly CheckinEnviado[]): Promise<{ novos: string[]; situacao: Map<string, Situacao> }>;
}

export interface AuditoriaCredenciamento {
  registrar(e: { atorId: string | null; acao: string; dados?: Record<string, unknown> }): Promise<void>;
}

export interface ChavePublicaQr {
  readonly kid: string;
  readonly publica: string;
}

export interface Pacote {
  readonly evento: EventoEquipe;
  readonly chaves: readonly ChavePublicaQr[];
  readonly participantes: readonly Participante[];
  readonly geradoEm: string;
}

export interface DependenciasCredenciamento {
  readonly repositorio: RepositorioCredenciamento;
  readonly auditoria: AuditoriaCredenciamento;
  /** Chaves públicas aceitas (a atual e, durante uma troca, a anterior). */
  readonly chaves: readonly ChavePublicaQr[];
  readonly agoraMs: () => number;
}

export class CredenciamentoServico {
  readonly #d: DependenciasCredenciamento;

  constructor(d: DependenciasCredenciamento) {
    this.#d = d;
  }

  eventos(pessoaId: string): Promise<EventoEquipe[]> {
    return this.#d.repositorio.eventosDaEquipe(pessoaId);
  }

  async #eventoDaEquipe(pessoaId: string, slug: string): Promise<EventoEquipe> {
    const evento = await this.#d.repositorio.evento(pessoaId, slug);
    if (!evento) throw new ErroCredenciamento('evento_inexistente', 'Evento não encontrado.');
    if (!(await this.#d.repositorio.eDaEquipe(pessoaId, evento.id))) {
      throw new ErroCredenciamento('sem_papel', 'Só a equipe de credenciamento do evento pode fazer isso.');
    }
    return evento;
  }

  async pacote(pessoaId: string, slug: string): Promise<Pacote> {
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    const participantes = await this.#d.repositorio.participantes(pessoaId, evento.id);
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'credenciamento.pacote', dados: { eventoId: evento.id, participantes: participantes.length } });
    return { evento, chaves: this.#d.chaves, participantes, geradoEm: new Date(this.#d.agoraMs()).toISOString() };
  }

  async sincronizar(pessoaId: string, slug: string, corpo: unknown): Promise<{ id: string; situacao: Situacao | 'ignorado' }[]> {
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    const lote = validarLote(corpo, this.#d.agoraMs());
    const { novos, situacao } = await this.#d.repositorio.registrar(pessoaId, evento.id, lote);
    // Check-in manual fica na auditoria com quem da equipe fez (feature 04).
    for (const c of lote) {
      if (c.metodo === 'manual' && novos.includes(c.id)) {
        await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'checkin.manual', dados: { eventoId: evento.id, ingressoId: c.ingressoId, portao: c.portao } });
      }
    }
    return lote.map((c) => ({ id: c.id, situacao: situacao.get(c.id) ?? 'ignorado' }));
  }
}

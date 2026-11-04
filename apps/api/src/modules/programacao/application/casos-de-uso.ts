/**
 * Casos de uso da agenda e dos favoritos.
 * A agenda é igual para todos (cacheável por versão); os favoritos são
 * por pessoa e ficam em outra rota, para não quebrar esse cache.
 */
import { ErroProgramacao, validarIdAtividade, validarSlug } from '../domain/programacao.ts';
import type { Atividade, Evento } from '../domain/programacao.ts';

export interface RepositorioProgramacao {
  eventoPorSlug(slug: string, pessoaId: string | null): Promise<Evento | null>;
  /** Muda sempre que alguma atividade visível muda, entra ou sai. */
  versaoAgenda(eventoId: string, pessoaId: string | null): Promise<string>;
  agenda(eventoId: string, pessoaId: string | null): Promise<Atividade[]>;
  favoritos(pessoaId: string, eventoId: string): Promise<string[]>;
  /** false quando a atividade não existe ou não é visível para a pessoa. */
  favoritar(pessoaId: string, atividadeId: string): Promise<boolean>;
  desfavoritar(pessoaId: string, atividadeId: string): Promise<void>;
}

export type ResultadoAgenda =
  | { readonly modificada: false; readonly versao: string }
  | { readonly modificada: true; readonly versao: string; readonly evento: Evento; readonly atividades: readonly Atividade[] };

export class ProgramacaoServico {
  readonly #repo: RepositorioProgramacao;

  constructor(repo: RepositorioProgramacao) {
    this.#repo = repo;
  }

  async #evento(slug: string, pessoaId: string | null): Promise<Evento> {
    const evento = await this.#repo.eventoPorSlug(validarSlug(slug), pessoaId);
    if (!evento) throw new ErroProgramacao('evento_inexistente', 'Evento não encontrado.');
    return evento;
  }

  async agenda(slug: string, pessoaId: string | null, versaoConhecida: string | null): Promise<ResultadoAgenda> {
    const evento = await this.#evento(slug, pessoaId);
    const versao = await this.#repo.versaoAgenda(evento.id, pessoaId);
    if (versaoConhecida === versao) return { modificada: false, versao };
    return { modificada: true, versao, evento, atividades: await this.#repo.agenda(evento.id, pessoaId) };
  }

  async favoritos(slug: string, pessoaId: string): Promise<string[]> {
    const evento = await this.#evento(slug, pessoaId);
    return this.#repo.favoritos(pessoaId, evento.id);
  }

  /** Idempotente: favoritar duas vezes dá no mesmo (a fila offline pode repetir). */
  async favoritar(pessoaId: string, atividadeId: string): Promise<void> {
    if (!(await this.#repo.favoritar(pessoaId, validarIdAtividade(atividadeId)))) {
      throw new ErroProgramacao('atividade_inexistente', 'Esta palestra não existe mais.');
    }
  }

  async desfavoritar(pessoaId: string, atividadeId: string): Promise<void> {
    await this.#repo.desfavoritar(pessoaId, validarIdAtividade(atividadeId));
  }
}

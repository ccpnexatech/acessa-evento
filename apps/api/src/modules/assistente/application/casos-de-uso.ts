/** Casos de uso do assistente: ler a versão publicada, publicar e avaliar. */
import { ErroGrafo, eResposta, validarCanais, validarGrafo } from '../domain/grafo.ts';
import type { Assistente } from '../domain/grafo.ts';

export interface RepositorioAssistente {
  eventoId(slug: string, pessoaId: string | null): Promise<string | null>;
  podePublicar(pessoaId: string, eventoId: string): Promise<boolean>;
  atual(eventoId: string, pessoaId: string | null): Promise<Assistente | null>;
  versao(eventoId: string, versao: number): Promise<Assistente | null>;
  /** Grava como próxima versão e devolve o número. */
  publicar(pessoaId: string, eventoId: string, a: Omit<Assistente, 'versao' | 'publicadoEm'>): Promise<number>;
  avaliar(eventoId: string, versao: number, respostaId: string, util: boolean): Promise<void>;
}

export type CodigoErroAssistente = 'evento_inexistente' | 'sem_assistente' | 'sem_papel' | 'dados_invalidos';

export class ErroAssistente extends Error {
  readonly codigo: CodigoErroAssistente;

  constructor(codigo: CodigoErroAssistente, mensagem: string) {
    super(mensagem);
    this.name = 'ErroAssistente';
    this.codigo = codigo;
  }
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class AssistenteServico {
  readonly #repo: RepositorioAssistente;

  constructor(repo: RepositorioAssistente) {
    this.#repo = repo;
  }

  async #evento(slug: string, pessoaId: string | null): Promise<string> {
    const id = /^[a-z0-9-]{3,60}$/.test(slug) ? await this.#repo.eventoId(slug, pessoaId) : null;
    if (!id) throw new ErroAssistente('evento_inexistente', 'Evento não encontrado.');
    return id;
  }

  async atual(slug: string, pessoaId: string | null): Promise<Assistente> {
    const a = await this.#repo.atual(await this.#evento(slug, pessoaId), pessoaId);
    if (!a) throw new ErroAssistente('sem_assistente', 'A organização ainda não publicou o assistente deste evento.');
    return a;
  }

  async publicar(pessoaId: string, slug: string, corpo: unknown): Promise<number> {
    const eventoId = await this.#evento(slug, pessoaId);
    if (!(await this.#repo.podePublicar(pessoaId, eventoId))) throw new ErroAssistente('sem_papel', 'Só a organização do evento publica o assistente.');
    try {
      if (!objeto(corpo)) throw new ErroGrafo('Envie "grafo" e "canais".');
      return await this.#repo.publicar(pessoaId, eventoId, { grafo: validarGrafo(corpo['grafo']), canais: validarCanais(corpo['canais']) });
    } catch (e) {
      if (e instanceof ErroGrafo) throw new ErroAssistente('dados_invalidos', e.message);
      throw e;
    }
  }

  /** Sem pessoa: a avaliação não guarda quem respondeu (feature 05). */
  async avaliar(slug: string, corpo: unknown): Promise<void> {
    const eventoId = await this.#evento(slug, null);
    const c = objeto(corpo) ? corpo : {};
    const { versao, respostaId, util } = c;
    if (typeof versao !== 'number' || !Number.isInteger(versao) || typeof respostaId !== 'string' || typeof util !== 'boolean') {
      throw new ErroAssistente('dados_invalidos', 'Envie versao, respostaId e util.');
    }
    const a = await this.#repo.versao(eventoId, versao);
    if (!a || !eResposta(a.grafo, respostaId)) throw new ErroAssistente('dados_invalidos', 'Resposta não encontrada nesta versão do assistente.');
    await this.#repo.avaliar(eventoId, versao, respostaId, util);
  }
}

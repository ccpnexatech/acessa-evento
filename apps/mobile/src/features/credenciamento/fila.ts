/**
 * Fila de check-ins do aparelho da equipe, guardada no Cofre.
 * Cada check-in tem id próprio: reenviar depois de uma queda nunca duplica.
 * "feitos" guarda o histórico local para reconhecer quem já entrou por aqui.
 */
import type { Requisitor } from '../../shared/api/cliente';
import { ErroApi } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import type { CheckinLocal } from './modelo';

export const LOTE = 200;

export class FilaCheckins {
  readonly #cofre: Cofre;
  readonly #chave: string;
  #pendentes: CheckinLocal[] = [];
  #feitos: CheckinLocal[] = [];

  constructor(cofre: Cofre, slug: string) {
    this.#cofre = cofre;
    this.#chave = `credenciamento-${slug}-fila`;
  }

  get pendentes(): readonly CheckinLocal[] {
    return this.#pendentes;
  }

  get feitos(): readonly CheckinLocal[] {
    return this.#feitos;
  }

  async carregar(): Promise<void> {
    const salvo = await lerJson<{ pendentes: CheckinLocal[]; feitos: CheckinLocal[] }>(this.#cofre, this.#chave);
    this.#pendentes = salvo?.pendentes ?? [];
    this.#feitos = salvo?.feitos ?? [];
  }

  async #salvar(): Promise<void> {
    await this.#cofre.gravar(this.#chave, JSON.stringify({ pendentes: this.#pendentes, feitos: this.#feitos }));
  }

  /** Grava antes de responder: se o app fechar, o check-in não se perde. */
  async adicionar(c: CheckinLocal): Promise<void> {
    this.#pendentes = [...this.#pendentes, c];
    this.#feitos = [...this.#feitos, c];
    await this.#salvar();
  }

  /**
   * Envia em lotes. Sem conexão ou erro do servidor, para e mantém o resto.
   * Erro 4xx de um lote (ex.: perdeu o papel) também para, para a equipe ver o motivo.
   */
  async sincronizar(requisitar: Requisitor, slug: string): Promise<number> {
    let enviados = 0;
    while (this.#pendentes.length) {
      const lote = this.#pendentes.slice(0, LOTE);
      await requisitar('POST', `/credenciamento/${encodeURIComponent(slug)}/checkins`, { corpo: { checkins: lote } });
      const ids = new Set(lote.map((c) => c.id));
      this.#pendentes = this.#pendentes.filter((c) => !ids.has(c.id));
      enviados += lote.length;
      await this.#salvar();
    }
    return enviados;
  }

  async limpar(): Promise<void> {
    this.#pendentes = [];
    this.#feitos = [];
    await this.#cofre.apagar(this.#chave);
  }
}

export const semConexao = (e: unknown): boolean => e instanceof ErroApi && (e.status === 0 || e.status >= 500);

/**
 * Fila de leituras do leitor por ponto, guardada no Cofre. Cada leitura tem id
 * próprio: reenviar depois de uma queda nunca duplica. "feitas" é o histórico
 * local, para reconhecer quem já passou por este aparelho.
 */
import type { Requisitor } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import type { LeituraLocal } from './leitor';

export const LOTE = 200;

export class FilaLeituras {
  readonly #cofre: Cofre;
  readonly #chave: string;
  #pendentes: LeituraLocal[] = [];
  #feitas: LeituraLocal[] = [];

  constructor(cofre: Cofre, slug: string) {
    this.#cofre = cofre;
    this.#chave = `acessos-${slug}-fila`;
  }

  get pendentes(): readonly LeituraLocal[] {
    return this.#pendentes;
  }

  get feitas(): readonly LeituraLocal[] {
    return this.#feitas;
  }

  async carregar(): Promise<void> {
    const salvo = await lerJson<{ pendentes: LeituraLocal[]; feitas: LeituraLocal[] }>(this.#cofre, this.#chave);
    this.#pendentes = salvo?.pendentes ?? [];
    this.#feitas = salvo?.feitas ?? [];
  }

  async #salvar(): Promise<void> {
    await this.#cofre.gravar(this.#chave, JSON.stringify({ pendentes: this.#pendentes, feitas: this.#feitas }));
  }

  /** Grava antes de responder: se o app fechar, a leitura não se perde. */
  async adicionar(l: LeituraLocal): Promise<void> {
    this.#pendentes = [...this.#pendentes, l];
    this.#feitas = [...this.#feitas, l];
    await this.#salvar();
  }

  /** Envia em lotes; qualquer falha para e mantém o resto na fila. */
  async sincronizar(requisitar: Requisitor, slug: string): Promise<number> {
    let enviadas = 0;
    while (this.#pendentes.length) {
      const lote = this.#pendentes.slice(0, LOTE);
      await requisitar('POST', `/acessos/${encodeURIComponent(slug)}/leituras`, { corpo: { leituras: lote } });
      const ids = new Set(lote.map((l) => l.id));
      this.#pendentes = this.#pendentes.filter((l) => !ids.has(l.id));
      enviadas += lote.length;
      await this.#salvar();
    }
    return enviadas;
  }
}

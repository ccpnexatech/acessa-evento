/**
 * Offline-first sem biblioteca (ADR 0018):
 * - AgendaOffline: mostra o que está salvo na hora e atualiza pela rede com
 *   ETag (304 = nada mudou, sem baixar de novo);
 * - FavoritosOffline: marca na hora, guarda numa fila e envia quando der.
 *   PUT e DELETE são idempotentes, então repetir a fila é seguro.
 */
import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import type { Agenda } from './modelo';

export const semConexao = (e: unknown): boolean => e instanceof ErroApi && e.status === 0;

export interface AgendaSalva {
  readonly agenda: Agenda;
  readonly salvaEm: string;
}

export class AgendaOffline {
  readonly #requisitar: Requisitor;
  readonly #cofre: Cofre;
  readonly #relogio: () => Date;

  constructor(requisitar: Requisitor, cofre: Cofre, relogio: () => Date = () => new Date()) {
    this.#requisitar = requisitar;
    this.#cofre = cofre;
    this.#relogio = relogio;
  }

  #chave = (slug: string): string => `agenda-${slug}`;

  salva(slug: string): Promise<AgendaSalva | null> {
    return lerJson<AgendaSalva>(this.#cofre, this.#chave(slug));
  }

  /** Busca na rede; devolve a agenda nova ou a salva (quando 304). Lança ErroApi sem conexão. */
  async sincronizar(slug: string): Promise<AgendaSalva> {
    const salva = await this.salva(slug);
    const r = await this.#requisitar<Agenda>('GET', `/eventos/${slug}/agenda`, {
      cabecalhos: salva ? { 'if-none-match': `"${salva.agenda.versao}"` } : {},
    });
    const agenda = r.status === 304 && salva ? salva.agenda : r.dados;
    if (!agenda) throw new ErroApi(r.status, 'resposta_vazia', 'A agenda veio vazia. Tente de novo.');
    const nova: AgendaSalva = { agenda, salvaEm: this.#relogio().toISOString() };
    await this.#cofre.gravar(this.#chave(slug), JSON.stringify(nova));
    return nova;
  }
}

interface Pendencia {
  readonly atividadeId: string;
  readonly marcar: boolean;
}

interface EstadoFavoritos {
  readonly ids: string[];
  readonly fila: Pendencia[];
}

export class FavoritosOffline {
  readonly #requisitar: Requisitor;
  readonly #cofre: Cofre;
  readonly #slug: string;
  #estado: EstadoFavoritos = { ids: [], fila: [] };
  #carregado = false;

  constructor(requisitar: Requisitor, cofre: Cofre, slug: string) {
    this.#requisitar = requisitar;
    this.#cofre = cofre;
    this.#slug = slug;
  }

  #chave = (): string => `favoritos-${this.#slug}`;

  async carregar(): Promise<ReadonlySet<string>> {
    if (!this.#carregado) {
      this.#estado = (await lerJson<EstadoFavoritos>(this.#cofre, this.#chave())) ?? { ids: [], fila: [] };
      this.#carregado = true;
    }
    return new Set(this.#estado.ids);
  }

  get pendentes(): number {
    return this.#estado.fila.length;
  }

  async #salvar(): Promise<void> {
    await this.#cofre.gravar(this.#chave(), JSON.stringify(this.#estado));
  }

  /** Muda na hora e guarda o pedido; só a última intenção por atividade fica na fila. */
  async alternar(atividadeId: string): Promise<ReadonlySet<string>> {
    await this.carregar();
    const marcar = !this.#estado.ids.includes(atividadeId);
    this.#estado = {
      ids: marcar ? [...this.#estado.ids, atividadeId] : this.#estado.ids.filter((i) => i !== atividadeId),
      fila: [...this.#estado.fila.filter((p) => p.atividadeId !== atividadeId), { atividadeId, marcar }],
    };
    await this.#salvar();
    return new Set(this.#estado.ids);
  }

  /**
   * Envia a fila e, se tudo foi, traz a lista do servidor (vale o que está lá).
   * Sem conexão, para no primeiro erro e mantém o resto para a próxima vez.
   */
  async sincronizar(): Promise<ReadonlySet<string>> {
    await this.carregar();
    while (this.#estado.fila.length) {
      const [p, ...resto] = this.#estado.fila;
      if (!p) break;
      try {
        await this.#requisitar(p.marcar ? 'PUT' : 'DELETE', `/favoritos/${p.atividadeId}`);
      } catch (e) {
        if (semConexao(e) || (e instanceof ErroApi && e.status >= 500)) throw e;
        // 404: a atividade saiu da agenda; 401: a sessão acabou. Nos dois, descartar o pedido.
      }
      this.#estado = { ...this.#estado, fila: resto };
      await this.#salvar();
    }
    const r = await this.#requisitar<{ atividades: string[] }>('GET', `/eventos/${this.#slug}/favoritos`);
    this.#estado = { ids: r.dados?.atividades ?? [], fila: [] };
    await this.#salvar();
    return new Set(this.#estado.ids);
  }
}

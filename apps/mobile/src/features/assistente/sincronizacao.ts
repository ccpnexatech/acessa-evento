/**
 * Assistente offline: guarda a última versão e só baixa de novo quando a
 * organização publica outra (ETag "v<versão>"). Avaliações feitas sem
 * internet ficam numa fila e sobem depois; elas não têm dado pessoal.
 */
import type { Requisitor } from '../../shared/api/cliente';
import { ErroApi } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';
import type { Assistente } from './modelo';

export interface Avaliacao { readonly versao: number; readonly respostaId: string; readonly util: boolean }

export class AssistenteOffline {
  readonly #requisitar: Requisitor;
  readonly #cofre: Cofre;
  readonly #slug: string;

  constructor(requisitar: Requisitor, cofre: Cofre, slug: string) {
    this.#requisitar = requisitar;
    this.#cofre = cofre;
    this.#slug = slug;
  }

  get #chave() {
    return `assistente-${this.#slug}`;
  }

  get #chaveFila() {
    return `assistente-${this.#slug}-avaliacoes`;
  }

  salvo(): Promise<Assistente | null> {
    return lerJson<Assistente>(this.#cofre, this.#chave);
  }

  async sincronizar(): Promise<Assistente> {
    const salvo = await this.salvo();
    const r = await this.#requisitar<Assistente>('GET', `/eventos/${encodeURIComponent(this.#slug)}/assistente`, {
      cabecalhos: salvo ? { 'if-none-match': `"v${salvo.versao}"` } : {},
    });
    if (r.status === 304 && salvo) return salvo;
    if (!r.dados) throw new Error('Resposta vazia do servidor.');
    await this.#cofre.gravar(this.#chave, JSON.stringify(r.dados));
    return r.dados;
  }

  /** Tenta enviar; sem internet, guarda para depois. Nunca falha para quem avaliou. */
  async avaliar(a: Avaliacao): Promise<void> {
    const fila = [...((await lerJson<Avaliacao[]>(this.#cofre, this.#chaveFila)) ?? []), a];
    await this.#cofre.gravar(this.#chaveFila, JSON.stringify(fila));
    await this.enviarPendentes();
  }

  async enviarPendentes(): Promise<number> {
    const fila = (await lerJson<Avaliacao[]>(this.#cofre, this.#chaveFila)) ?? [];
    let enviadas = 0;
    for (const a of fila) {
      try {
        await this.#requisitar('POST', `/eventos/${encodeURIComponent(this.#slug)}/assistente/avaliacoes`, { corpo: a });
      } catch (e) {
        // Sem conexão ou servidor fora: para e tenta depois. 4xx: descarta (versão ou resposta que não existe mais).
        if (e instanceof ErroApi && (e.status === 0 || e.status >= 500)) break;
      }
      enviadas++;
    }
    const resto = fila.slice(enviadas);
    if (resto.length) await this.#cofre.gravar(this.#chaveFila, JSON.stringify(resto));
    else await this.#cofre.apagar(this.#chaveFila);
    return enviadas;
  }
}

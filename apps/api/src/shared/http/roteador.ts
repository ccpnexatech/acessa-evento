import { ErroHttp } from './tipos.ts';
import type { Manipulador, Metodo, Requisicao } from './tipos.ts';

/**
 * Roteador mínimo por método + caminho exato. Cada módulo registra as
 * próprias rotas (Open/Closed: novos módulos não alteram este arquivo).
 */
export class Roteador {
  readonly #rotas = new Map<string, Map<Metodo, Manipulador>>();

  registrar(metodo: Metodo, caminho: string, manipulador: Manipulador): this {
    const porMetodo = this.#rotas.get(caminho) ?? new Map<Metodo, Manipulador>();
    if (porMetodo.has(metodo)) throw new Error(`Rota duplicada: ${metodo} ${caminho}`);
    porMetodo.set(metodo, manipulador);
    this.#rotas.set(caminho, porMetodo);
    return this;
  }

  resolver(req: Requisicao): Manipulador {
    const porMetodo = this.#rotas.get(req.caminho);
    if (!porMetodo) throw new ErroHttp(404, 'rota_inexistente', 'Este endereço não existe.');
    const manipulador = porMetodo.get(req.metodo);
    if (!manipulador) {
      throw new ErroHttp(405, 'metodo_nao_permitido', `Use ${[...porMetodo.keys()].join(', ')} neste endereço.`);
    }
    return manipulador;
  }
}

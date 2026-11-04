import { ErroHttp } from './tipos.ts';
import type { Manipulador, Metodo } from './tipos.ts';

/**
 * Roteador mínimo por método + caminho, com parâmetros no formato `:nome`
 * (ex.: `/eventos/:slug/agenda`). Cada módulo registra as próprias rotas
 * (Open/Closed: novos módulos não alteram este arquivo).
 */
export interface Rota {
  readonly manipulador: Manipulador;
  readonly parametros: Readonly<Record<string, string>>;
}

interface Padrao {
  readonly texto: string;
  readonly partes: readonly string[];
  readonly metodos: Map<Metodo, Manipulador>;
}

const partes = (caminho: string): string[] => caminho.split('/').filter(Boolean);

export class Roteador {
  readonly #padroes: Padrao[] = [];

  registrar(metodo: Metodo, caminho: string, manipulador: Manipulador): this {
    let p = this.#padroes.find((x) => x.texto === caminho);
    if (!p) {
      p = { texto: caminho, partes: partes(caminho), metodos: new Map() };
      // Rotas sem parâmetro vêm antes: /eventos/novo vence /eventos/:slug.
      this.#padroes.push(p);
      this.#padroes.sort((a, b) => a.partes.filter((s) => s.startsWith(':')).length - b.partes.filter((s) => s.startsWith(':')).length);
    }
    if (p.metodos.has(metodo)) throw new Error(`Rota duplicada: ${metodo} ${caminho}`);
    p.metodos.set(metodo, manipulador);
    return this;
  }

  resolver(metodo: Metodo, caminho: string): Rota {
    const pedaços = partes(caminho);
    for (const p of this.#padroes) {
      const parametros = casar(p.partes, pedaços);
      if (!parametros) continue;
      const manipulador = p.metodos.get(metodo);
      if (!manipulador) {
        throw new ErroHttp(405, 'metodo_nao_permitido', `Use ${[...p.metodos.keys()].join(', ')} neste endereço.`);
      }
      return { manipulador, parametros };
    }
    throw new ErroHttp(404, 'rota_inexistente', 'Este endereço não existe.');
  }
}

function casar(padrao: readonly string[], caminho: readonly string[]): Record<string, string> | null {
  if (padrao.length !== caminho.length) return null;
  const parametros: Record<string, string> = {};
  for (let i = 0; i < padrao.length; i++) {
    const esperado = padrao[i] ?? '';
    const recebido = caminho[i] ?? '';
    if (esperado.startsWith(':')) {
      let valor: string;
      try {
        valor = decodeURIComponent(recebido);
      } catch {
        return null;
      }
      if (!valor || valor.includes('/')) return null;
      parametros[esperado.slice(1)] = valor;
    } else if (esperado !== recebido) {
      return null;
    }
  }
  return parametros;
}

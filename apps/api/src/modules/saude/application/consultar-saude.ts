import { estadoGeral } from '../domain/saude.ts';
import type { EstadoDependencia, RelatorioSaude } from '../domain/saude.ts';
import type { Relogio, VerificadorDependencia } from './ports.ts';

export interface ConfigConsultarSaude {
  readonly versao: string;
  readonly iniciadoEmMs: number;
  /** Uma verificação mais lenta que isto conta como falha. */
  readonly limiteMs: number;
}

/**
 * Caso de uso: monta o relatório de saúde consultando cada dependência
 * em paralelo, com tempo-limite, sem deixar uma falha derrubar a resposta.
 */
export class ConsultarSaude {
  readonly #verificadores: readonly VerificadorDependencia[];
  readonly #relogio: Relogio;
  readonly #config: ConfigConsultarSaude;

  constructor(verificadores: readonly VerificadorDependencia[], relogio: Relogio, config: ConfigConsultarSaude) {
    this.#verificadores = verificadores;
    this.#relogio = relogio;
    this.#config = config;
  }

  async executar(): Promise<RelatorioSaude> {
    const dependencias = await Promise.all(this.#verificadores.map((v) => this.#medir(v)));
    return {
      estado: estadoGeral(dependencias),
      versao: this.#config.versao,
      ativoHaSegundos: Math.floor((this.#relogio.agoraMs() - this.#config.iniciadoEmMs) / 1000),
      dependencias,
    };
  }

  async #medir(v: VerificadorDependencia): Promise<EstadoDependencia> {
    const inicio = this.#relogio.agoraMs();
    let estado: EstadoDependencia['estado'];
    try {
      estado = await comLimite(v.verificar(), this.#config.limiteMs);
    } catch {
      estado = 'falha';
    }
    return { nome: v.nome, estado, latenciaMs: this.#relogio.agoraMs() - inicio };
  }
}

function comLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error('tempo-limite')), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

/** Porta de log: casos de uso e adaptadores dependem só desta interface. */
export type Nivel = 'debug' | 'info' | 'warn' | 'error';
export type Campos = Readonly<Record<string, unknown>>;

export interface Logger {
  log(nivel: Nivel, mensagem: string, campos?: Campos): void;
}

/** Nunca registrar estes campos, nem por engano (LGPD). */
const CENSURADOS = new Set(['authorization', 'cookie', 'senha', 'token', 'email', 'cpf', 'codigo']);

export function censurar(campos: Campos): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(campos)) {
    saida[chave] = CENSURADOS.has(chave.toLowerCase()) ? '[censurado]' : valor;
  }
  return saida;
}

/** Log em JSON, uma linha por evento, pronto para qualquer coletor. */
export class LoggerJson implements Logger {
  readonly #escrever: (linha: string) => void;
  readonly #minimo: number;
  static readonly #ORDEM: Readonly<Record<Nivel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

  constructor(escrever: (linha: string) => void, nivelMinimo: Nivel = 'info') {
    this.#escrever = escrever;
    this.#minimo = LoggerJson.#ORDEM[nivelMinimo];
  }

  log(nivel: Nivel, mensagem: string, campos: Campos = {}): void {
    if (LoggerJson.#ORDEM[nivel] < this.#minimo) return;
    this.#escrever(`${JSON.stringify({ hora: new Date().toISOString(), nivel, mensagem, ...censurar(campos) })}\n`);
  }
}

/** Para testes: descarta tudo. */
export const loggerSilencioso: Logger = { log: () => undefined };

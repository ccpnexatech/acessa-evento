/** Contrato HTTP interno, independente de node:http (Interface Segregation). */
export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Requisicao {
  readonly id: string;
  readonly metodo: Metodo;
  readonly caminho: string;
  /** Valores dos trechos `:nome` da rota. */
  readonly parametros: Readonly<Record<string, string>>;
  readonly consulta: URLSearchParams;
  readonly cabecalhos: Readonly<Record<string, string | undefined>>;
  readonly corpo: unknown;
}

export interface Resposta {
  readonly status: number;
  readonly corpo?: unknown;
  readonly cabecalhos?: Readonly<Record<string, string>>;
}

export type Manipulador = (req: Requisicao) => Promise<Resposta>;

/** Erro com status HTTP e um código estável que o app sabe traduzir. */
export class ErroHttp extends Error {
  readonly status: number;
  readonly codigo: string;

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.codigo = codigo;
  }
}

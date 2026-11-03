/**
 * Cliente HTTP mínimo sobre o fetch nativo. Traduz qualquer falha num
 * ErroApi com código estável e mensagem pronta para mostrar à pessoa.
 */
export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: string;

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
  }
}

export interface OpcoesCliente {
  readonly baseUrl: string;
  readonly obterToken?: () => Promise<string | null>;
  readonly fetch?: typeof fetch;
  readonly tempoLimiteMs?: number;
}

export type ClienteApi = <T>(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown) => Promise<T>;

const SEM_CONEXAO = 'Sem internet. Confira a conexão e tente de novo.';
const FALHA_GENERICA = 'Algo deu errado do nosso lado. Tente de novo em instantes.';

export function criarClienteApi(o: OpcoesCliente): ClienteApi {
  const chamar = o.fetch ?? fetch;
  return async <T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> => {
    const token = o.obterToken ? await o.obterToken() : null;
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), o.tempoLimiteMs ?? 15_000);
    let resposta: Response;
    try {
      resposta = await chamar(`${o.baseUrl}${caminho}`, {
        method: metodo,
        headers: {
          accept: 'application/json',
          ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
        signal: controle.signal,
      });
    } catch {
      throw new ErroApi(0, 'sem_conexao', SEM_CONEXAO);
    } finally {
      clearTimeout(timer);
    }

    const texto = await resposta.text();
    let dados: unknown = undefined;
    try {
      dados = texto ? JSON.parse(texto) : undefined;
    } catch {
      dados = undefined;
    }
    if (!resposta.ok) {
      const p = (dados ?? {}) as { codigo?: unknown; titulo?: unknown };
      throw new ErroApi(
        resposta.status,
        typeof p.codigo === 'string' ? p.codigo : 'erro_desconhecido',
        typeof p.titulo === 'string' && resposta.status < 500 ? p.titulo : FALHA_GENERICA,
      );
    }
    return dados as T;
  };
}

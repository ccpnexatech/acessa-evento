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

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RespostaHttp<T> {
  readonly status: number;
  readonly dados: T | undefined;
  readonly etag: string | null;
}

/** Acesso completo à resposta (status, ETag); 304 não é erro. */
export type Requisitor = <T>(metodo: Metodo, caminho: string, opcoes?: { corpo?: unknown; cabecalhos?: Record<string, string> }) => Promise<RespostaHttp<T>>;

/** Atalho para o caso comum: só os dados. */
export type ClienteApi = <T>(metodo: Metodo, caminho: string, corpo?: unknown) => Promise<T>;

const SEM_CONEXAO = 'Não foi possível falar com o servidor. Confira a internet e tente de novo.';
const FALHA_GENERICA = 'Algo deu errado do nosso lado. Tente de novo em instantes.';

export function criarRequisitor(o: OpcoesCliente): Requisitor {
  const chamar = o.fetch ?? fetch;
  return async <T>(metodo: Metodo, caminho: string, opcoes: { corpo?: unknown; cabecalhos?: Record<string, string> } = {}) => {
    const { corpo, cabecalhos = {} } = opcoes;
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
          ...cabecalhos,
        },
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
        signal: controle.signal,
      });
    } catch {
      throw new ErroApi(0, 'sem_conexao', SEM_CONEXAO);
    } finally {
      clearTimeout(timer);
    }

    const texto = resposta.status === 304 ? '' : await resposta.text();
    let dados: unknown = undefined;
    try {
      dados = texto ? JSON.parse(texto) : undefined;
    } catch {
      dados = undefined;
    }
    if (!resposta.ok && resposta.status !== 304) {
      const p = (dados ?? {}) as { codigo?: unknown; titulo?: unknown };
      throw new ErroApi(
        resposta.status,
        typeof p.codigo === 'string' ? p.codigo : 'erro_desconhecido',
        typeof p.titulo === 'string' && resposta.status < 500 ? p.titulo : FALHA_GENERICA,
      );
    }
    return { status: resposta.status, dados: dados as T | undefined, etag: resposta.headers.get('etag') };
  };
}

export function criarClienteApi(o: OpcoesCliente): ClienteApi {
  const requisitar = criarRequisitor(o);
  return async <T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> =>
    (await requisitar<T>(metodo, caminho, corpo === undefined ? {} : { corpo })).dados as T;
}

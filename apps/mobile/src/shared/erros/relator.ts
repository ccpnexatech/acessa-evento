/**
 * Cópia do relator da API (apps/api/src/shared/erros/relator.ts) para o app.
 * Relator de erros (porta) e adaptador para o Sentry sem SDK: um POST do
 * "envelope" do Sentry com fetch. Envia só o tipo, a mensagem, a pilha e
 * etiquetas técnicas (rota, id da requisição): nunca corpo, cabeçalhos,
 * e-mail ou token. Sem DSN, nada é enviado (ADR 0024).
 */
export interface ContextoErro {
  readonly etiquetas?: Readonly<Record<string, string>>;
}

export interface RelatorErros {
  capturar(erro: unknown, contexto?: ContextoErro): void;
}

export const relatorNulo: RelatorErros = { capturar: () => undefined };

export interface Dsn {
  readonly chave: string;
  readonly endpoint: string;
}

/** https://<chave>@<host>/<projeto> → endpoint de envelope. */
export function lerDsn(texto: string): Dsn | null {
  try {
    const u = new URL(texto);
    const projeto = u.pathname.replace(/^\/+|\/+$/g, '');
    if (u.protocol !== 'https:' || !u.username || !/^\d+$/.test(projeto)) return null;
    return { chave: u.username, endpoint: `https://${u.host}/api/${projeto}/envelope/` };
  } catch {
    return null;
  }
}

const hex32 = (aleatorio: () => number) => Array.from({ length: 32 }, () => Math.floor(aleatorio() * 16).toString(16)).join('');

/** Corta e-mails e tokens que possam ter vazado para a mensagem do erro. */
export function limpar(texto: string): string {
  return texto
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[e-mail]')
    .replace(/\b(Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g, '[token]')
    .slice(0, 8000);
}

export interface OpcoesSentry {
  readonly dsn: Dsn;
  readonly ambiente: string;
  readonly versao: string;
  readonly plataforma: 'node' | 'javascript';
  readonly fetch?: typeof fetch;
  readonly agora?: () => Date;
  readonly aleatorio?: () => number;
  /** Para avisar no log quando o envio falha; o erro original nunca é engolido em silêncio. */
  readonly aoFalhar?: (motivo: string) => void;
}

export function envelopeSentry(erro: unknown, contexto: ContextoErro, o: OpcoesSentry): string {
  const agora = (o.agora ?? (() => new Date()))();
  const id = hex32(o.aleatorio ?? Math.random);
  const e = erro instanceof Error ? erro : new Error(typeof erro === 'string' ? erro : 'Erro não identificado');
  const evento = {
    event_id: id,
    timestamp: agora.toISOString(),
    platform: o.plataforma,
    level: 'error',
    environment: o.ambiente,
    release: o.versao,
    tags: contexto.etiquetas ?? {},
    exception: { values: [{ type: e.name, value: limpar(e.message), stacktrace: { frames: [{ filename: limpar(e.stack ?? '').slice(0, 4000) }] } }] },
  };
  return [JSON.stringify({ event_id: id, sent_at: agora.toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(evento)].join('\n');
}

export function relatorSentry(o: OpcoesSentry): RelatorErros {
  const enviar = o.fetch ?? fetch;
  return {
    capturar(erro, contexto = {}) {
      void enviar(o.dsn.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${o.dsn.chave}, sentry_client=acessa-evento/${o.versao}`,
        },
        body: envelopeSentry(erro, contexto, o),
        // AbortSignal.timeout nem sempre existe no Hermes.
        ...(typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(5000) } : {}),
      })
        .then((r) => {
          if (!r.ok) o.aoFalhar?.(`HTTP ${r.status}`);
        })
        .catch((e: unknown) => o.aoFalhar?.(e instanceof Error ? e.message : String(e)));
    },
  };
}

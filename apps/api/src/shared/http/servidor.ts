/**
 * Adaptador entre node:http e o contrato interno (Requisicao/Resposta).
 * Concentra o que toda rota precisa: id da requisição, cabeçalhos de
 * segurança, CORS por lista, limite e validação do corpo JSON, erros no
 * formato Problem Details (RFC 9457) e log de acesso.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ErroHttp } from './tipos.ts';
import type { Metodo, Requisicao, Resposta } from './tipos.ts';
import type { Roteador } from './roteador.ts';
import type { Logger } from '../logger.ts';
import type { RelatorErros } from '../erros/relator.ts';

export interface OpcoesServidor {
  readonly roteador: Roteador;
  readonly logger: Logger;
  readonly corsOrigens: readonly string[];
  readonly producao: boolean;
  readonly limiteCorpoBytes?: number;
  /** Para onde vão os erros inesperados (500), além do log. */
  readonly relator?: RelatorErros;
}

const METODOS = new Set<Metodo>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const COM_CORPO = new Set<Metodo>(['POST', 'PUT', 'PATCH']);

const SEGURANCA: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-site',
  'cache-control': 'no-store',
};

export function criarServidor(opcoes: OpcoesServidor): Server {
  const limite = opcoes.limiteCorpoBytes ?? 64 * 1024;
  const servidor = createServer((req, res) => {
    void atender(req, res, opcoes, limite);
  });
  servidor.requestTimeout = 15_000;
  servidor.headersTimeout = 10_000;
  servidor.keepAliveTimeout = 5_000;
  return servidor;
}

async function atender(req: IncomingMessage, res: ServerResponse, o: OpcoesServidor, limite: number): Promise<void> {
  const inicio = performance.now();
  const id = randomUUID();
  const url = new URL(req.url ?? '/', 'http://local');
  const origem = req.headers.origin;
  const cabecalhosBase: Record<string, string> = { ...SEGURANCA, 'x-request-id': id };
  if (o.producao) cabecalhosBase['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  if (origem && o.corsOrigens.includes(origem)) {
    cabecalhosBase['access-control-allow-origin'] = origem;
    cabecalhosBase['vary'] = 'Origin';
  }

  let resposta: Resposta;
  try {
    if (req.method === 'OPTIONS') {
      resposta = preflight(origem, o.corsOrigens);
    } else {
      const metodo = req.method as Metodo;
      if (!METODOS.has(metodo)) throw new ErroHttp(405, 'metodo_nao_permitido', 'Método não suportado.');
      const corpo = COM_CORPO.has(metodo) ? await lerJson(req, limite) : undefined;
      const caminho = normalizar(url.pathname);
      const rota = o.roteador.resolver(metodo, caminho);
      const requisicao: Requisicao = {
        id,
        metodo,
        caminho,
        parametros: rota.parametros,
        consulta: url.searchParams,
        cabecalhos: achatar(req.headers),
        corpo,
      };
      resposta = await rota.manipulador(requisicao);
    }
  } catch (erro) {
    resposta = problema(erro, id, o.logger);
    if (resposta.status === 500) {
      o.relator?.capturar(erro, { etiquetas: { rota: `${req.method ?? ''} ${normalizar(url.pathname)}`, requisicao: id } });
    }
  }

  const temCorpo = resposta.corpo !== undefined;
  const tipo = resposta.status >= 400 ? 'application/problem+json' : 'application/json';
  res.writeHead(resposta.status, {
    ...cabecalhosBase,
    ...(temCorpo ? { 'content-type': `${tipo}; charset=utf-8` } : {}),
    ...resposta.cabecalhos,
  });
  res.end(temCorpo ? JSON.stringify(resposta.corpo) : undefined);

  o.logger.log('info', 'requisicao', {
    id,
    metodo: req.method,
    caminho: url.pathname,
    status: resposta.status,
    duracaoMs: Math.round(performance.now() - inicio),
  });
}

function preflight(origem: string | undefined, permitidas: readonly string[]): Resposta {
  if (!origem || !permitidas.includes(origem)) return { status: 403, corpo: { titulo: 'Origem não permitida', codigo: 'origem_nao_permitida' } };
  return {
    status: 204,
    cabecalhos: {
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
      'access-control-allow-headers': 'authorization, content-type, idempotency-key',
      'access-control-max-age': '600',
    },
  };
}

async function lerJson(req: IncomingMessage, limite: number): Promise<unknown> {
  const tipo = req.headers['content-type'] ?? '';
  const declarado = Number(req.headers['content-length'] ?? '0');
  if (declarado > limite) throw new ErroHttp(413, 'corpo_grande_demais', `O corpo passa de ${limite} bytes.`);
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const bloco = parte as Buffer;
    total += bloco.length;
    if (total > limite) throw new ErroHttp(413, 'corpo_grande_demais', `O corpo passa de ${limite} bytes.`);
    partes.push(bloco);
  }
  if (total === 0) return undefined;
  if (!/^application\/json\b/i.test(tipo)) throw new ErroHttp(415, 'tipo_nao_suportado', 'Envie o corpo como application/json.');
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8')) as unknown;
  } catch {
    throw new ErroHttp(400, 'json_invalido', 'O corpo não é um JSON válido.');
  }
}

function problema(erro: unknown, id: string, logger: Logger): Resposta {
  if (erro instanceof ErroHttp) {
    return { status: erro.status, corpo: { titulo: erro.message, status: erro.status, codigo: erro.codigo, idRequisicao: id } };
  }
  logger.log('error', 'erro_inesperado', { id, erro: erro instanceof Error ? erro.stack : String(erro) });
  return {
    status: 500,
    corpo: { titulo: 'Algo deu errado do nosso lado. Tente de novo em instantes.', status: 500, codigo: 'erro_interno', idRequisicao: id },
  };
}

function normalizar(caminho: string): string {
  return caminho.length > 1 ? caminho.replace(/\/+$/, '') : caminho;
}

function achatar(h: IncomingMessage['headers']): Record<string, string | undefined> {
  const saida: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(h)) saida[k] = Array.isArray(v) ? v.join(', ') : v;
  return saida;
}

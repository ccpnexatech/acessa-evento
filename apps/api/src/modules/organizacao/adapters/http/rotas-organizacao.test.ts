import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import type { OrganizacaoServico } from '../../application/organizacao.ts';
import { registrarRotasOrganizacao } from './rotas-organizacao.ts';
import { ErroDominio } from '../../../../shared/dominio/erro.ts';

let servidor: Server;
let base: string;
const chamadas: string[] = [];

before(async () => {
  // Serviço de mentira: cada método anota que foi chamado; "recusar" simula a regra negando.
  const servico = new Proxy({}, {
    get: (_alvo, nome: string) => async (...args: unknown[]) => {
      chamadas.push(nome);
      if (args.includes('recusar')) throw new ErroDominio('regra', 'Este convite não vale mais. Peça um novo a quem convidou.');
      return { ok: nome };
    },
  }) as OrganizacaoServico;
  const r = new Roteador();
  registrarRotasOrganizacao(r, servico, {
    exigir: async (req) => {
      if (!req.cabecalhos['authorization']) throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
      return { pessoaId: 'p1' };
    },
    opcional: async () => null,
  });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

const pedir = (metodo: string, caminho: string, corpo?: unknown, sessao = true) => fetch(`${base}${caminho}`, {
  method: metodo,
  headers: { ...(sessao ? { authorization: 'Bearer t' } : {}), ...(corpo === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});

test('cada rota chama o seu caso de uso, com o status certo', async () => {
  const ROTAS: [string, string, number, string][] = [
    ['GET', '/organizador/inicio', 200, 'inicio'],
    ['POST', '/organizador/organizacoes', 201, 'criarOrganizacao'],
    ['POST', '/organizador/organizacoes/o1/eventos', 201, 'criarEvento'],
    ['POST', '/organizador/organizacoes/o1/convites', 201, 'convidarParaOrganizacao'],
    ['GET', '/organizador/eventos/cocal-2026', 200, 'evento'],
    ['PATCH', '/organizador/eventos/cocal-2026', 204, 'alterarEvento'],
    ['GET', '/organizador/eventos/cocal-2026/equipe', 200, 'equipe'],
    ['PUT', '/organizador/eventos/cocal-2026/equipe/p2', 204, 'definirMembro'],
    ['DELETE', '/organizador/eventos/cocal-2026/equipe/p2', 204, 'removerMembro'],
    ['POST', '/organizador/eventos/cocal-2026/convites', 201, 'convidarParaEvento'],
    ['DELETE', '/organizador/convites/c1', 204, 'revogarConvite'],
    ['GET', '/convites', 200, 'convites'],
    ['POST', '/convites/c1/aceitar', 204, 'aceitarConvite'],
  ];
  for (const [metodo, caminho, status, caso] of ROTAS) {
    chamadas.length = 0;
    const r = await pedir(metodo, caminho, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
    assert.equal(r.status, status, `${metodo} ${caminho}`);
    assert.deepEqual(chamadas, [caso], `${metodo} ${caminho}`);
    if (status !== 204) assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.equal((await pedir(metodo, caminho, undefined, false)).status, 401);
  }
});

test('regra negada vira 409 com a frase pronta', async () => {
  const r = await pedir('POST', '/convites/recusar/aceitar', {});
  assert.equal(r.status, 409);
  assert.match(((await r.json()) as { titulo: string }).titulo, /não vale mais/);
});

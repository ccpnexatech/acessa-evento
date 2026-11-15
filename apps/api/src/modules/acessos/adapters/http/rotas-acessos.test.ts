import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { ErroDominio } from '../../../../shared/dominio/erro.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import type { AcessosServico } from '../../application/acessos.ts';
import { registrarRotasAcessos } from './rotas-acessos.ts';

let servidor: Server;
let base: string;
const chamadas: string[] = [];

before(async () => {
  const servico = new Proxy({}, {
    get: (_alvo, nome: string) => async (...args: unknown[]) => {
      chamadas.push(nome);
      if (args.includes('fechado')) throw new ErroDominio('sem_permissao', 'Só a equipe de portão do evento pode fazer isso.');
      return { ok: nome };
    },
  }) as AcessosServico;
  const r = new Roteador();
  registrarRotasAcessos(r, servico, {
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

test('cada rota chama o seu caso de uso, com o status certo, só com sessão e sem cache', async () => {
  const EV = '/organizador/eventos/cocal-2026';
  const ROTAS: [string, string, number, string][] = [
    ['GET', `${EV}/regras-zona`, 200, 'regras'],
    ['PUT', `${EV}/zonas/z1/regras`, 204, 'definirRegras'],
    ['GET', `${EV}/credenciais`, 200, 'credenciais'],
    ['POST', `${EV}/credenciais`, 201, 'emitir'],
    ['POST', `${EV}/credenciais/c1/revogar`, 204, 'revogar'],
    ['PUT', `${EV}/credenciais/c1/excecoes/z1`, 204, 'definirExcecao'],
    ['DELETE', `${EV}/credenciais/c1/excecoes/z1`, 204, 'removerExcecao'],
    ['GET', `${EV}/hoje`, 200, 'hoje'],
    ['GET', '/acessos/cocal-2026/pacote', 200, 'pacote'],
    ['POST', '/acessos/cocal-2026/leituras', 200, 'sincronizar'],
    ['POST', '/acessos/cocal-2026/meias/m1/conferir', 204, 'conferirMeia'],
    ['GET', '/credenciais', 200, 'minhas'],
    ['GET', '/eventos/cocal-2026/avisos', 200, 'avisos'],
  ];
  for (const [metodo, caminho, status, caso] of ROTAS) {
    chamadas.length = 0;
    const r = await pedir(metodo, caminho, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
    assert.equal(r.status, status, `${metodo} ${caminho}`);
    assert.deepEqual(chamadas, [caso], `${metodo} ${caminho}`);
    if (status !== 204) assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.equal((await pedir(metodo, caminho, undefined, false)).status, 401);
  }
  assert.deepEqual(await (await pedir('POST', '/acessos/cocal-2026/leituras', {})).json(), { resultado: { ok: 'sincronizar' } });
});

test('falta de papel vira 403', async () => {
  assert.equal((await pedir('GET', '/acessos/fechado/pacote')).status, 403);
});

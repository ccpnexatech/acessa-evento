import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import { ProgramacaoServico } from '../../application/casos-de-uso.ts';
import { registrarRotasProgramacao } from './rotas-programacao.ts';

const ID = '01900000-0000-7000-8000-000000000001';
const VERSAO = 'b'.repeat(32);
let servidor: Server;
let base: string;

before(async () => {
  const servico = new ProgramacaoServico({
    eventoPorSlug: async (slug) => (slug === 'cocal-2026' ? { id: 'e1', slug, nome: 'COCAL', inicio: '2026-07-01', fim: '2026-07-03', local: 'F', fuso: 'America/Fortaleza' } : null),
    versaoAgenda: async () => VERSAO,
    agenda: async () => [],
    favoritos: async () => [ID],
    favoritar: async (_p, id) => id === ID,
    desfavoritar: async () => undefined,
  });
  const r = new Roteador();
  registrarRotasProgramacao(r, servico, {
    exigir: async (req) => {
      if (req.cabecalhos['authorization'] !== 'Bearer ok') throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
      return { pessoaId: 'p1' };
    },
    opcional: async (req) => (req.cabecalhos['authorization'] ? { pessoaId: 'p1' } : null),
  });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

test('agenda: 200 com ETag e cache público; 304 com If-None-Match; privado com sessão', async () => {
  const r = await fetch(`${base}/eventos/cocal-2026/agenda`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('etag'), `"${VERSAO}"`);
  assert.equal(r.headers.get('cache-control'), 'public, no-cache');
  assert.equal((await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { 'if-none-match': `"${VERSAO}"` } })).status, 304);
  assert.equal((await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { 'if-none-match': 'W/"lixo"' } })).status, 200);
  const privada = await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { authorization: 'Bearer ok' } });
  assert.equal(privada.headers.get('cache-control'), 'private, no-cache');
});

test('erros de programação viram 404; sem sessão, 401', async () => {
  assert.equal((await fetch(`${base}/eventos/outro/agenda`)).status, 404);
  assert.equal((await fetch(`${base}/eventos/cocal-2026/favoritos`)).status, 401);
  assert.equal((await fetch(`${base}/favoritos/nao-uuid`, { method: 'PUT', headers: { authorization: 'Bearer ok' } })).status, 404);
});

test('favoritos: lista, marca e desmarca', async () => {
  const auth = { authorization: 'Bearer ok' };
  const lista = await fetch(`${base}/eventos/cocal-2026/favoritos`, { headers: auth });
  assert.deepEqual(await lista.json(), { atividades: [ID] });
  assert.equal((await fetch(`${base}/favoritos/${ID}`, { method: 'PUT', headers: auth })).status, 204);
  assert.equal((await fetch(`${base}/favoritos/${ID}`, { method: 'DELETE', headers: auth })).status, 204);
});

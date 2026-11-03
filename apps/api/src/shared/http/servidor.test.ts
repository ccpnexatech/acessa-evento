import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarServidor } from './servidor.ts';
import { Roteador } from './roteador.ts';
import { ErroHttp } from './tipos.ts';
import { loggerSilencioso } from '../logger.ts';

let servidor: Server;
let base: string;

before(async () => {
  const r = new Roteador()
    .registrar('GET', '/ola', async () => ({ status: 200, corpo: { ola: 'mundo' } }))
    .registrar('POST', '/eco', async (req) => ({ status: 201, corpo: { recebido: req.corpo } }))
    .registrar('GET', '/proibido', async () => { throw new ErroHttp(403, 'sem_permissao', 'Sem permissão.'); })
    .registrar('GET', '/quebra', async () => { throw new Error('boom'); })
    .registrar('DELETE', '/vazio', async () => ({ status: 204 }));
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: ['https://app.exemplo'], producao: true, limiteCorpoBytes: 32 });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

test('responde JSON com cabeçalhos de segurança e id da requisição', async () => {
  const r = await fetch(`${base}/ola/`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ola: 'mundo' });
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(r.headers.get('strict-transport-security') ?? '', /max-age=/);
  assert.match(r.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});

test('lê corpo JSON', async () => {
  const r = await fetch(`${base}/eco`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { recebido: { a: 1 } });
});

test('aceita POST sem corpo', async () => {
  const r = await fetch(`${base}/eco`, { method: 'POST' });
  assert.deepEqual(await r.json(), {});
});

test('responde 204 sem corpo', async () => {
  const r = await fetch(`${base}/vazio`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('content-type'), null);
});

for (const [nome, init, status, codigo] of [
  ['JSON inválido', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }, 400, 'json_invalido'],
  ['tipo não suportado', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'oi' }, 415, 'tipo_nao_suportado'],
  ['corpo grande demais', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(64) }) }, 413, 'corpo_grande_demais'],
] as const) {
  test(`recusa ${nome} com Problem Details`, async () => {
    const r = await fetch(`${base}/eco`, init);
    assert.equal(r.status, status);
    assert.match(r.headers.get('content-type') ?? '', /application\/problem\+json/);
    const corpo = (await r.json()) as Record<string, unknown>;
    assert.equal(corpo['codigo'], codigo);
    assert.equal(corpo['idRequisicao'], r.headers.get('x-request-id'));
  });
}

test('erro conhecido mantém status e código', async () => {
  const r = await fetch(`${base}/proibido`);
  assert.equal(r.status, 403);
  assert.equal(((await r.json()) as { codigo: string }).codigo, 'sem_permissao');
});

test('erro inesperado vira 500 sem vazar detalhes', async () => {
  const r = await fetch(`${base}/quebra`);
  assert.equal(r.status, 500);
  const texto = await r.text();
  assert.doesNotMatch(texto, /boom/);
  assert.match(texto, /erro_interno/);
});

test('método fora da lista é 405', async () => {
  const r = await fetch(`${base}/ola`, { method: 'PROPFIND' });
  assert.equal(r.status, 405);
});

test('CORS só para origens permitidas', async () => {
  const ok = await fetch(`${base}/ola`, { headers: { origin: 'https://app.exemplo' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.exemplo');
  const fora = await fetch(`${base}/ola`, { headers: { origin: 'https://mal.exemplo' } });
  assert.equal(fora.headers.get('access-control-allow-origin'), null);
});

test('preflight: 204 para origem permitida, 403 para as outras', async () => {
  const ok = await fetch(`${base}/eco`, { method: 'OPTIONS', headers: { origin: 'https://app.exemplo' } });
  assert.equal(ok.status, 204);
  assert.match(ok.headers.get('access-control-allow-headers') ?? '', /idempotency-key/);
  const fora = await fetch(`${base}/eco`, { method: 'OPTIONS', headers: { origin: 'https://mal.exemplo' } });
  assert.equal(fora.status, 403);
});

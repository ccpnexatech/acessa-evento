/** Tradução HTTP do módulo conta, com as portas em memória (sem banco). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import { contaEmMemoria } from '../../../../../test/apoio/conta-em-memoria.ts';
import { registrarRotasConta } from './rotas-conta.ts';

const d = contaEmMemoria();
let servidor: Server;
let base: string;

before(async () => {
  const r = new Roteador();
  registrarRotasConta(r, d);
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

const json = (corpo: unknown, token?: string): RequestInit => ({
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(corpo),
});

test('cada rota responde com o status e o corpo do contrato', async () => {
  const pedido = await fetch(`${base}/acesso/codigo`, { method: 'POST', ...json({ email: 'a@b.com' }) });
  assert.equal(pedido.status, 202);
  assert.ok(((await pedido.json()) as { expiraEm: string }).expiraEm);

  const entrada = await fetch(`${base}/acesso/entrar`, { method: 'POST', ...json({ email: 'a@b.com', codigo: d.emailsEnviados[0]?.codigo }) });
  const { token, primeiroAcesso } = (await entrada.json()) as { token: string; primeiroAcesso: boolean };
  assert.equal(primeiroAcesso, true);
  const auth = { authorization: `Bearer ${token}` };

  const conta = await fetch(`${base}/conta`, { headers: auth });
  assert.equal(((await conta.json()) as { email: string }).email, 'a@b.com');

  const pa = await fetch(`${base}/conta/primeiro-acesso`, { method: 'PUT', ...json({ nomeCracha: 'Ana Lima', aceitaTermos: true, versaoTermos: '2026-11-03' }, token) });
  assert.equal(pa.status, 200);

  const exp = await fetch(`${base}/conta/exportacao`, { headers: auth });
  assert.match(exp.headers.get('content-disposition') ?? '', /meus-dados/);

  assert.equal((await fetch(`${base}/acesso/sair`, { method: 'POST', headers: auth })).status, 204);
  assert.equal((await fetch(`${base}/conta`, { headers: auth })).status, 401);
});

test('mapeia cada erro de regra para um status estável', async () => {
  const casos: [string, RequestInit, number, string][] = [
    ['/acesso/codigo', { method: 'POST', ...json({ email: 'x' }) }, 422, 'email_invalido'],
    ['/acesso/codigo', { method: 'POST', ...json(['lista']) }, 422, 'email_invalido'],
    ['/acesso/entrar', { method: 'POST', ...json({ email: 'novo@b.com', codigo: '123456' }) }, 410, 'codigo_vencido'],
    ['/conta', { method: 'GET' }, 401, 'sessao_invalida'],
    ['/conta', { method: 'DELETE', headers: { authorization: 'Bearer curto' } }, 401, 'sessao_invalida'],
  ];
  for (const [caminho, init, status, codigo] of casos) {
    const r = await fetch(`${base}${caminho}`, init);
    assert.equal(r.status, status, caminho);
    assert.equal(((await r.json()) as { codigo: string }).codigo, codigo);
  }
});

test('excluir a conta responde 204', async () => {
  await fetch(`${base}/acesso/codigo`, { method: 'POST', ...json({ email: 'z@b.com' }) });
  const r = await fetch(`${base}/acesso/entrar`, { method: 'POST', ...json({ email: 'z@b.com', codigo: d.emailsEnviados.at(-1)?.codigo }) });
  const { token } = (await r.json()) as { token: string };
  assert.equal((await fetch(`${base}/conta`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })).status, 204);
});

test('erro que não é de regra continua sendo 500 genérico', async () => {
  const quebrado = { ...d, email: { enviarCodigo: async () => { throw new Error('smtp fora'); } } };
  const r = new Roteador();
  registrarRotasConta(r, quebrado);
  const s = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => s.listen(0, ok));
  try {
    const resp = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/acesso/codigo`, { method: 'POST', ...json({ email: 'q@b.com' }) });
    assert.equal(resp.status, 500);
    assert.doesNotMatch(await resp.text(), /smtp/);
  } finally {
    s.close();
  }
});

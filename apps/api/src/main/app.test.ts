import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { criarApp } from './app.ts';
import { loggerSilencioso } from '../shared/logger.ts';

const subir = async (verificadores: Parameters<typeof criarApp>[0]['verificadores'] = []) => {
  const app = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: '9.9.9',
    verificadores,
  });
  await new Promise<void>((ok) => app.listen(0, ok));
  return { app, base: `http://127.0.0.1:${(app.address() as AddressInfo).port}` };
};

test('GET /saude responde 200 com versão', async () => {
  const { app, base } = await subir();
  try {
    const r = await fetch(`${base}/saude`);
    assert.equal(r.status, 200);
    const corpo = (await r.json()) as { estado: string; versao: string };
    assert.equal(corpo.estado, 'ok');
    assert.equal(corpo.versao, '9.9.9');
  } finally {
    app.close();
  }
});

test('GET /saude responde 503 quando uma dependência falha', async () => {
  const { app, base } = await subir([{ nome: 'banco', verificar: async () => { throw new Error('fora'); } }]);
  try {
    assert.equal((await fetch(`${base}/saude`)).status, 503);
  } finally {
    app.close();
  }
});

test('dependenciasConta escolhe o e-mail pelo provedor e liga as portas reais', async () => {
  const { dependenciasConta } = await import('./app.ts');
  const { Banco } = await import('../shared/db/banco.ts');
  const { randomBytes } = await import('node:crypto');
  const banco = new Banco({ url: 'postgres://ninguem@127.0.0.1:1/nada' });
  const chaves = { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) };
  try {
    const dev = dependenciasConta(banco, { url: 'x', chaves, email: { provedor: 'dev' } }, loggerSilencioso);
    const resend = dependenciasConta(banco, { url: 'x', chaves, email: { provedor: 'resend', chave: 'k', remetente: 'r' } }, loggerSilencioso);
    assert.notEqual(dev.email, resend.email);
    assert.ok(dev.relogio.agora() instanceof Date);
    assert.equal(dev.protecao.decifrar(dev.protecao.cifrar('x', 'c'), 'c'), 'x');
  } finally {
    await banco.fechar();
  }
});

test('o verificador do banco usa o ping', async () => {
  const { verificadorBanco } = await import('../shared/db/verificador-banco.ts');
  const { verificadoresPadrao } = await import('./app.ts');
  assert.equal(await verificadorBanco({ ping: async () => undefined }).verificar(), 'ok');
  assert.deepEqual(verificadoresPadrao(undefined), []);
});

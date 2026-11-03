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

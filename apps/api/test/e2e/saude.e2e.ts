/**
 * E2E: sobe o processo real (node src/main/server.ts), como em produção,
 * e fala com ele só por HTTP.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

let processo: ChildProcess;
let base: string;

before(async () => {
  const entrada = fileURLToPath(new URL('../../src/main/server.ts', import.meta.url));
  processo = spawn(process.execPath, [entrada], {
    env: { ...process.env, PORTA: '0', AMBIENTE: 'teste' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  base = await new Promise<string>((resolver, rejeitar) => {
    const limite = setTimeout(() => rejeitar(new Error('o servidor não subiu em 10 s')), 10_000);
    processo.stdout?.on('data', (bloco: Buffer) => {
      for (const linha of bloco.toString().split('\n').filter(Boolean)) {
        const evento = JSON.parse(linha) as { mensagem: string; porta?: number };
        if (evento.mensagem === 'ouvindo') {
          clearTimeout(limite);
          resolver(`http://127.0.0.1:${evento.porta}`);
        }
      }
    });
  });
});

after(async () => {
  processo.kill('SIGTERM');
  const [codigo] = (await once(processo, 'exit')) as [number | null];
  assert.equal(codigo, 0, 'o servidor deve encerrar com elegância');
});

test('o monitor de disponibilidade recebe 200 em /saude', async () => {
  const r = await fetch(`${base}/saude`);
  assert.equal(r.status, 200);
  const corpo = (await r.json()) as { estado: string; versao: string; ativoHaSegundos: number };
  assert.equal(corpo.estado, 'ok');
  assert.match(corpo.versao, /^\d+\.\d+\.\d+$/);
  assert.ok(corpo.ativoHaSegundos >= 0);
});

test('endereço inexistente devolve 404 em Problem Details', async () => {
  const r = await fetch(`${base}/nao-existe`);
  assert.equal(r.status, 404);
  assert.equal(((await r.json()) as { codigo: string }).codigo, 'rota_inexistente');
});

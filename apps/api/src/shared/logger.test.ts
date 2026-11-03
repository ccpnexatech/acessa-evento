import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoggerJson, censurar, loggerSilencioso } from './logger.ts';

test('escreve uma linha JSON por evento', () => {
  const linhas: string[] = [];
  new LoggerJson((l) => linhas.push(l)).log('info', 'oi', { a: 1 });
  const evento = JSON.parse(linhas[0] ?? '{}') as Record<string, unknown>;
  assert.equal(evento['mensagem'], 'oi');
  assert.equal(evento['nivel'], 'info');
  assert.equal(evento['a'], 1);
  assert.ok(linhas[0]?.endsWith('\n'));
});

test('respeita o nível mínimo', () => {
  const linhas: string[] = [];
  const l = new LoggerJson((x) => linhas.push(x), 'warn');
  l.log('info', 'some');
  l.log('error', 'fica');
  assert.equal(linhas.length, 1);
});

test('censura dados pessoais e credenciais', () => {
  assert.deepEqual(censurar({ Email: 'a@b.c', Authorization: 'Bearer x', status: 200 }), {
    Email: '[censurado]',
    Authorization: '[censurado]',
    status: 200,
  });
});

test('o logger silencioso não faz nada', () => {
  assert.equal(loggerSilencioso.log('info', 'x'), undefined);
});

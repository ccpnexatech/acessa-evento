import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoGeral } from './saude.ts';

const d = (estado: 'ok' | 'degradado' | 'falha') => ({ nome: estado, estado, latenciaMs: 0 });

test('sem dependências, o estado é ok', () => assert.equal(estadoGeral([]), 'ok'));
test('degradado vence ok', () => assert.equal(estadoGeral([d('ok'), d('degradado')]), 'degradado'));
test('falha vence todos', () => assert.equal(estadoGeral([d('falha'), d('degradado'), d('ok')]), 'falha'));

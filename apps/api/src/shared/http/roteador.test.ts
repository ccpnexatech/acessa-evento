import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Roteador } from './roteador.ts';
import type { ErroHttp } from './tipos.ts';

const ok = async () => ({ status: 200 });
const outro = async () => ({ status: 201 });

test('resolve pela combinação de método e caminho', () => {
  const r = new Roteador().registrar('GET', '/a', ok);
  assert.deepEqual(r.resolver('GET', '/a'), { manipulador: ok, parametros: {} });
});

test('extrai parâmetros e decodifica', () => {
  const r = new Roteador().registrar('GET', '/eventos/:slug/atividades/:id', ok);
  assert.deepEqual(r.resolver('GET', '/eventos/cocal-2026/atividades/a%20b').parametros, { slug: 'cocal-2026', id: 'a b' });
});

test('rota fixa vence rota com parâmetro, em qualquer ordem de registro', () => {
  const r = new Roteador().registrar('GET', '/eventos/:slug', ok).registrar('GET', '/eventos/novos', outro);
  assert.equal(r.resolver('GET', '/eventos/novos').manipulador, outro);
  assert.equal(r.resolver('GET', '/eventos/cocal').manipulador, ok);
});

test('parâmetro vazio, com barra codificada ou mal codificado não casa', () => {
  const r = new Roteador().registrar('GET', '/a/:x', ok);
  for (const c of ['/a/%2F', '/a/%E0%A4%A', '/a/b/c']) {
    assert.throws(() => r.resolver('GET', c), (e: ErroHttp) => e.status === 404, c);
  }
});

test('caminho desconhecido é 404', () => {
  assert.throws(() => new Roteador().resolver('GET', '/x'), (e: ErroHttp) => e.status === 404 && e.codigo === 'rota_inexistente');
});

test('método errado é 405 e diz quais métodos valem', () => {
  const r = new Roteador().registrar('GET', '/a', ok);
  assert.throws(() => r.resolver('POST', '/a'), (e: ErroHttp) => e.status === 405 && /GET/.test(e.message));
});

test('recusa rota duplicada', () => {
  const r = new Roteador().registrar('GET', '/a', ok);
  assert.throws(() => r.registrar('GET', '/a', ok), /duplicada/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Roteador } from './roteador.ts';
import type { ErroHttp, Requisicao } from './tipos.ts';

const req = (metodo: Requisicao['metodo'], caminho: string): Requisicao => ({
  id: '1', metodo, caminho, consulta: new URLSearchParams(), cabecalhos: {}, corpo: undefined,
});
const ok = async () => ({ status: 200 });

test('resolve pela combinação de método e caminho', () => {
  const r = new Roteador().registrar('GET', '/a', ok);
  assert.equal(r.resolver(req('GET', '/a')), ok);
});

test('caminho desconhecido é 404', () => {
  assert.throws(() => new Roteador().resolver(req('GET', '/x')), (e: ErroHttp) => e.status === 404 && e.codigo === 'rota_inexistente');
});

test('método errado é 405 e diz quais métodos valem', () => {
  const r = new Roteador().registrar('GET', '/a', ok);
  assert.throws(() => r.resolver(req('POST', '/a')), (e: ErroHttp) => e.status === 405 && /GET/.test(e.message));
});

test('recusa rota duplicada', () => {
  const r = new Roteador().registrar('GET', '/a', ok);
  assert.throws(() => r.registrar('GET', '/a', ok), /duplicada/);
});

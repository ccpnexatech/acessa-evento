import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerConfig } from './config.ts';

test('usa padrões seguros quando nada é informado', () => {
  assert.deepEqual(lerConfig({}), { porta: 3333, ambiente: 'desenvolvimento', corsOrigens: [] });
});

test('lê porta, ambiente e origens', () => {
  const c = lerConfig({ PORTA: '8080', AMBIENTE: 'producao', CORS_ORIGENS: 'https://a.com, https://b.com' });
  assert.deepEqual(c, { porta: 8080, ambiente: 'producao', corsOrigens: ['https://a.com', 'https://b.com'] });
});

test('junta todos os erros numa mensagem só', () => {
  assert.throws(
    () => lerConfig({ PORTA: 'abc', AMBIENTE: 'qa', CORS_ORIGENS: 'nao-e-url' }),
    (e: Error) => /PORTA inválida/.test(e.message) && /AMBIENTE inválido/.test(e.message) && /origem inválida/.test(e.message),
  );
});

test('recusa origem sem HTTPS em produção', () => {
  assert.throws(() => lerConfig({ AMBIENTE: 'producao', CORS_ORIGENS: 'http://a.com' }), /sem HTTPS/);
});

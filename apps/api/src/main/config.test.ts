import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { lerConfig } from './config.ts';

const chaves = { CHAVES_CIFRA: `1:${randomBytes(32).toString('base64')}`, CHAVE_INDICE: randomBytes(32).toString('base64') };

test('usa padrões seguros quando nada é informado', () => {
  assert.deepEqual(lerConfig({}), { porta: 3333, ambiente: 'desenvolvimento', corsOrigens: [] });
});

test('lê porta, ambiente, origens, banco, chaves e e-mail', () => {
  const c = lerConfig({
    PORTA: '8080', AMBIENTE: 'producao', CORS_ORIGENS: 'https://a.com, https://b.com', DATABASE_URL: 'postgres://api@db/acessa',
    RESEND_API_KEY: 're_teste', EMAIL_REMETENTE: 'Acessa Evento <acesso@exemplo.com.br>', ...chaves,
  });
  assert.equal(c.porta, 8080);
  assert.deepEqual(c.corsOrigens, ['https://a.com', 'https://b.com']);
  assert.equal(c.banco?.url, 'postgres://api@db/acessa');
  assert.equal(c.banco?.chaves.atual, 1);
  assert.deepEqual(c.banco?.email, { provedor: 'resend', chave: 're_teste', remetente: 'Acessa Evento <acesso@exemplo.com.br>' });
});

test('em desenvolvimento, o e-mail padrão é o de log', () => {
  assert.deepEqual(lerConfig({ DATABASE_URL: 'postgres://x/y', ...chaves }).banco?.email, { provedor: 'dev' });
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

test('banco exige URL válida e chaves; produção exige banco e e-mail real', () => {
  assert.throws(() => lerConfig({ DATABASE_URL: 'mysql://x', ...chaves }), /postgres:\/\//);
  assert.throws(() => lerConfig({ DATABASE_URL: 'postgres://x/y' }), /CHAVES_CIFRA/);
  assert.throws(() => lerConfig({ AMBIENTE: 'producao' }), /obrigatória em produção/);
  assert.throws(() => lerConfig({ AMBIENTE: 'producao', DATABASE_URL: 'postgres://x/y', EMAIL_PROVEDOR: 'dev', ...chaves }), /não é permitido em produção/);
  assert.throws(() => lerConfig({ AMBIENTE: 'producao', DATABASE_URL: 'postgres://x/y', ...chaves }), /RESEND_API_KEY/);
  assert.throws(() => lerConfig({ DATABASE_URL: 'postgres://x/y', EMAIL_PROVEDOR: 'pombo', ...chaves }), /EMAIL_PROVEDOR inválido/);
});

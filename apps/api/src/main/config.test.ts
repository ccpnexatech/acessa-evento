import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { lerConfig } from './config.ts';

const QR = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const chaves = { CHAVES_CIFRA: `1:${randomBytes(32).toString('base64')}`, CHAVE_INDICE: randomBytes(32).toString('base64') };

test('usa padrões seguros quando nada é informado', () => {
  assert.deepEqual(lerConfig({}), { porta: 3333, ambiente: 'desenvolvimento', corsOrigens: [] });
});

test('lê porta, ambiente, origens, banco, chaves e e-mail', () => {
  const c = lerConfig({
    PORTA: '8080', AMBIENTE: 'producao', CORS_ORIGENS: 'https://a.com, https://b.com', DATABASE_URL: 'postgres://api@db/acessa',
    RESEND_API_KEY: 're_teste', EMAIL_REMETENTE: 'Acessa Evento <acesso@exemplo.com.br>', QR_CHAVE_PRIVADA: QR, ...chaves,
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

test('chave do QR: lida do ambiente, obrigatória em produção e validada', () => {
  const der = (t: 'ed25519' | 'x25519') => (t === 'ed25519' ? generateKeyPairSync('ed25519') : generateKeyPairSync('x25519')).privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const base = { DATABASE_URL: 'postgres://x/y', ...chaves };
  const c = lerConfig({ ...base, QR_CHAVE_PRIVADA: der('ed25519'), QR_CHAVE_ID: 'qr-2026' });
  assert.equal(c.banco?.qr?.kid, 'qr-2026');
  assert.equal(lerConfig(base).banco?.qr, undefined);
  assert.throws(() => lerConfig({ ...base, QR_CHAVE_PRIVADA: 'lixo' }), /QR_CHAVE_PRIVADA inválida/);
  assert.throws(() => lerConfig({ ...base, QR_CHAVE_PRIVADA: der('x25519') }), /QR_CHAVE_PRIVADA inválida/);
  assert.throws(() => lerConfig({ ...base, QR_CHAVE_PRIVADA: der('ed25519'), QR_CHAVE_ID: 'Com Espaço' }), /QR_CHAVE_ID/);
  assert.throws(() => lerConfig({ ...base, AMBIENTE: 'producao', RESEND_API_KEY: 'r', EMAIL_REMETENTE: 'a <a@b.co>' }), /QR_CHAVE_PRIVADA é obrigatória/);
});

test('SENTRY_DSN opcional e validado', () => {
  assert.equal(lerConfig({}).sentryDsn, undefined);
  assert.deepEqual(lerConfig({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/7' }).sentryDsn, { chave: 'k', endpoint: 'https://o1.ingest.sentry.io/api/7/envelope/' });
  assert.throws(() => lerConfig({ SENTRY_DSN: 'qualquer coisa' }), /SENTRY_DSN inválido/);
});

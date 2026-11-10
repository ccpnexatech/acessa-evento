import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envelopeSentry, lerDsn, limpar, relatorNulo, relatorSentry } from './relator.ts';

const dsn = lerDsn('https://abc123@o1.ingest.sentry.io/42');
const base = { ambiente: 'teste', versao: '0.8.0', plataforma: 'node' as const, agora: () => new Date('2026-11-10T12:00:00Z'), aleatorio: () => 0.5 };

test('lê o DSN e recusa formatos inválidos', () => {
  assert.deepEqual(dsn, { chave: 'abc123', endpoint: 'https://o1.ingest.sentry.io/api/42/envelope/' });
  for (const ruim of ['', 'http://a@b.io/1', 'https://b.io/1', 'https://a@b.io/projeto']) assert.equal(lerDsn(ruim), null, ruim);
});

test('envelope tem cabeçalho, item e evento, sem e-mail nem token', () => {
  assert.ok(dsn);
  const linhas = envelopeSentry(new Error('falhou para ana@exemplo.com.br com token ' + 'x'.repeat(40)), { etiquetas: { rota: 'GET /ingressos' } }, { ...base, dsn }).split('\n');
  assert.equal(linhas.length, 3);
  assert.deepEqual(JSON.parse(linhas[1] ?? ''), { type: 'event' });
  const evento = JSON.parse(linhas[2] ?? '') as { event_id: string; tags: unknown; exception: { values: { value: string }[] } };
  assert.equal(evento.event_id, '8'.repeat(32));
  assert.deepEqual(evento.tags, { rota: 'GET /ingressos' });
  assert.equal(evento.exception.values[0]?.value, 'falhou para [e-mail] com token [token]');
  assert.doesNotMatch(linhas.join(''), /ana@exemplo/);
  assert.match(JSON.parse(envelopeSentry('texto', {}, { ...base, dsn }).split('\n')[2] ?? '').exception.values[0].type, /Error/);
  assert.match(envelopeSentry(42, {}, { ...base, dsn }), /Erro não identificado/);
});

test('envia com autenticação e avisa quando o envio falha', async () => {
  assert.ok(dsn);
  const chamadas: { url: string; init: RequestInit }[] = [];
  const falhas: string[] = [];
  const respostas = [new Response(null, { status: 200 }), new Response(null, { status: 429 })];
  const fetchFalso = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const r = respostas.shift();
    if (!r) throw new Error('rede');
    return r;
  }) as unknown as typeof fetch;
  const r = relatorSentry({ ...base, dsn, fetch: fetchFalso, aoFalhar: (m) => falhas.push(m) });
  r.capturar(new Error('a'));
  r.capturar(new Error('b'));
  r.capturar(new Error('c'));
  await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(chamadas[0]?.url, 'https://o1.ingest.sentry.io/api/42/envelope/');
  assert.match(String((chamadas[0]?.init.headers as Record<string, string>)['x-sentry-auth']), /sentry_key=abc123/);
  assert.deepEqual(falhas, ['HTTP 429', 'rede']);
  relatorNulo.capturar(new Error('nada'));
  assert.equal(limpar('ok'), 'ok');
});

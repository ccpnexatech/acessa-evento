/** Feature 03 pela API: agenda pública com ETag e favoritos por pessoa, com Postgres real. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { semear } from '../../src/shared/db/semeador.ts';
import { loggerSilencioso } from '../../src/shared/logger.ts';
import { criarApp, dependenciasConta, dependenciasProgramacao } from '../../src/main/app.ts';

let b: BancoDeTeste;
let banco: Banco;
let app: Server;
let base: string;
const caixa: { email: string; codigo: string }[] = [];

before(async () => {
  b = await criarBancoDeTeste();
  await semear(b.dono, fileURLToPath(new URL('../../db/sementes', import.meta.url)));
  banco = new Banco({ url: b.url, papel: 'app_api' });
  const chaves = { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) };
  app = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: '0.4.0',
    conta: {
      ...dependenciasConta(banco, { url: b.url, chaves, email: { provedor: 'dev' } }, loggerSilencioso),
      email: { enviarCodigo: async (email: string, codigo: string) => { caixa.push({ email, codigo }); } },
    },
    programacao: dependenciasProgramacao(banco),
  });
  await new Promise<void>((ok) => app.listen(0, ok));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((ok) => app.close(() => ok()));
  await banco.fechar();
  await b.apagar();
});

async function entrar(email: string): Promise<string> {
  await fetch(`${base}/acesso/codigo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const codigo = caixa.filter((c) => c.email === email).at(-1)?.codigo;
  const r = await fetch(`${base}/acesso/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, codigo }) });
  return ((await r.json()) as { token: string }).token;
}

interface Agenda {
  evento: { nome: string };
  atividades: { id: string; titulo: string; recursos: string[]; inicio: string; sala: { nome: string; acessibilidade: string } | null; palestrantes: { nome: string }[] }[];
}

test('agenda pública traz atividades em ordem, com sala, recursos e palestrantes', async () => {
  const r = await fetch(`${base}/eventos/cocal-2026/agenda`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('etag') ?? '', /^"[0-9a-f]{32}"$/);
  assert.equal(r.headers.get('cache-control'), 'public, no-cache');
  const a = (await r.json()) as Agenda;
  assert.equal(a.evento.nome, 'COCAL 2026');
  assert.equal(a.atividades.length, 6);
  const inicios = a.atividades.map((x) => x.inicio);
  assert.deepEqual(inicios, [...inicios].sort());
  const abertura = a.atividades[0];
  assert.deepEqual(abertura?.recursos, ['libras', 'legenda']);
  assert.equal(abertura?.sala?.nome, 'Auditório 1');
  assert.match(abertura?.sala?.acessibilidade ?? '', /intérprete/);
  assert.deepEqual(abertura?.palestrantes.map((p) => p.nome), ['Ana Ribeiro', 'Bruno Maia']);
});

test('com o ETag, a agenda responde 304 até alguma atividade mudar', async () => {
  const primeira = await fetch(`${base}/eventos/cocal-2026/agenda`);
  const etag = primeira.headers.get('etag') ?? '';
  const igual = await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { 'if-none-match': etag } });
  assert.equal(igual.status, 304);
  assert.equal(await igual.text(), '');

  await b.dono.query("update sala set nome = 'Auditório 1 (novo)' where nome = 'Auditório 1'");
  const mudou = await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { 'if-none-match': etag } });
  assert.equal(mudou.status, 200);
  assert.notEqual(mudou.headers.get('etag'), etag);
  const a = (await mudou.json()) as Agenda;
  assert.equal(a.atividades[0]?.sala?.nome, 'Auditório 1 (novo)');
});

test('evento inexistente ou em rascunho não aparece', async () => {
  await b.dono.query("insert into evento (slug, nome, inicio, fim, local) values ('rascunho', 'Rascunho', '2026-09-01', '2026-09-02', 'X')");
  for (const slug of ['rascunho', 'nao-existe']) {
    const r = await fetch(`${base}/eventos/${slug}/agenda`);
    assert.equal(r.status, 404, slug);
    assert.equal(((await r.json()) as { codigo: string }).codigo, 'evento_inexistente');
  }
});

test('favoritos são por pessoa, idempotentes e exigem sessão', async () => {
  const a = (await (await fetch(`${base}/eventos/cocal-2026/agenda`)).json()) as Agenda;
  const [primeira, segunda] = a.atividades;
  assert.ok(primeira && segunda);
  const ana = await entrar('ana@exemplo.com.br');
  const bia = await entrar('bia@exemplo.com.br');
  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  assert.equal((await fetch(`${base}/favoritos/${primeira.id}`, { method: 'PUT' })).status, 401);
  for (let i = 0; i < 2; i++) assert.equal((await fetch(`${base}/favoritos/${primeira.id}`, { method: 'PUT', headers: auth(ana) })).status, 204);
  assert.equal((await fetch(`${base}/favoritos/${segunda.id}`, { method: 'PUT', headers: auth(bia) })).status, 204);

  const favAna = (await (await fetch(`${base}/eventos/cocal-2026/favoritos`, { headers: auth(ana) })).json()) as { atividades: string[] };
  const favBia = (await (await fetch(`${base}/eventos/cocal-2026/favoritos`, { headers: auth(bia) })).json()) as { atividades: string[] };
  assert.deepEqual(favAna.atividades, [primeira.id]);
  assert.deepEqual(favBia.atividades, [segunda.id]);

  for (let i = 0; i < 2; i++) assert.equal((await fetch(`${base}/favoritos/${primeira.id}`, { method: 'DELETE', headers: auth(ana) })).status, 204);
  const depois = (await (await fetch(`${base}/eventos/cocal-2026/favoritos`, { headers: auth(ana) })).json()) as { atividades: string[] };
  assert.deepEqual(depois.atividades, []);

  const inexistente = await fetch(`${base}/favoritos/01900000-0000-7000-8000-00000000ffff`, { method: 'PUT', headers: auth(ana) });
  assert.equal(inexistente.status, 404);
  assert.equal((await fetch(`${base}/eventos/cocal-2026/favoritos`)).status, 401);
});

test('com sessão, a agenda continua a mesma e não vai para cache compartilhado', async () => {
  const token = await entrar('caio@exemplo.com.br');
  const r = await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'private, no-cache');
  assert.equal(((await r.json()) as Agenda).atividades.length, 6);
  const invalida = await fetch(`${base}/eventos/cocal-2026/agenda`, { headers: { authorization: 'Bearer x'.padEnd(50, 'x') } });
  assert.equal(invalida.status, 401);
});

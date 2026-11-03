/**
 * Prova as garantias do banco usando o papel real da API (app_api):
 * UUID v7, isolamento por RLS e auditoria encadeada e imutável.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';

const primeira = <T>(linhas: readonly T[]): T => {
  const [linha] = linhas;
  if (linha === undefined) throw new Error('consulta sem linhas');
  return linha;
};

let b: BancoDeTeste;
let api: Banco;
const ids = {} as Record<'eventoA' | 'eventoB' | 'rascunho' | 'ana' | 'bia' | 'caio', string>;

before(async () => {
  b = await criarBancoDeTeste();
  api = new Banco({ url: b.url, papel: 'app_api' });
  const ev = async (slug: string, publicado: boolean) =>
    primeira((await b.dono.query<{ id: string }>(
      "insert into evento (slug, nome, inicio, fim, local, publicado) values ($1, $1, '2026-07-01', '2026-07-03', 'Fortaleza', $2) returning id",
      [slug, publicado],
    )).rows).id;
  const pessoa = async (n: number) =>
    primeira((await b.dono.query<{ id: string }>(
      'insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id',
      [Buffer.from('cifrado'), Buffer.alloc(32, n), `p${n}`],
    )).rows).id;
  ids.eventoA = await ev('evento-a', true);
  ids.eventoB = await ev('evento-b', true);
  ids.rascunho = await ev('rascunho', false);
  ids.ana = await pessoa(1);
  ids.bia = await pessoa(2);
  ids.caio = await pessoa(3);
  await b.dono.query(
    `insert into membro_organizacao (evento_id, pessoa_id, papel) values
       ($1, $2, 'admin'), ($3, $4, 'admin'), ($1, $5, 'credenciamento')`,
    [ids.eventoA, ids.ana, ids.eventoB, ids.bia, ids.caio],
  );
});

after(async () => {
  await api.fechar();
  await b.apagar();
});

test('uuid_v7 gera UUIDs da versão 7 em ordem de tempo', async () => {
  const { rows } = await b.dono.query<{ u: string }>('select uuid_v7()::text as u from generate_series(1, 50)');
  for (const { u } of rows) assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const prefixos = rows.map((r) => r.u.slice(0, 13));
  assert.deepEqual(prefixos, [...prefixos].sort());
});

test('sem contexto, a API não vê pessoa nem equipe', async () => {
  const r = await api.transacao({}, async (tx) => ({
    pessoas: await tx.consultar('select * from pessoa'),
    membros: await tx.consultar('select * from membro_organizacao'),
  }));
  assert.deepEqual(r, { pessoas: [], membros: [] });
});

test('evento publicado é público; rascunho só para quem organiza', async () => {
  const anonimo = await api.transacao({}, (tx) => tx.consultar<{ slug: string }>('select slug from evento order by slug'));
  assert.deepEqual(anonimo.map((e) => e.slug), ['evento-a', 'evento-b']);
});

test('cada pessoa só lê e altera a si mesma', async () => {
  const visto = await api.transacao({ pessoaId: ids.ana }, (tx) => tx.consultar<{ id: string }>('select id from pessoa'));
  assert.deepEqual(visto.map((p) => p.id), [ids.ana]);
  const alterados = await api.transacao({ pessoaId: ids.ana }, (tx) =>
    tx.consultar("update pessoa set nome_cracha = 'x' where id = $1 returning id", [ids.bia]));
  assert.equal(alterados.length, 0);
});

test('admin de um evento não vê a equipe de outro evento', async () => {
  const equipe = await api.transacao({ pessoaId: ids.ana, eventoId: ids.eventoA }, (tx) =>
    tx.consultar<{ evento_id: string }>('select evento_id from membro_organizacao'));
  assert.ok(equipe.length === 2 && equipe.every((m) => m.evento_id === ids.eventoA));
});

test('quem não é admin não adiciona ninguém à equipe', async () => {
  await assert.rejects(
    api.transacao({ pessoaId: ids.caio, eventoId: ids.eventoA }, (tx) =>
      tx.consultar("insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'admin')", [ids.eventoA, ids.caio])),
    /row-level security/,
  );
});

test('a API não altera colunas fora da lista permitida', async () => {
  await assert.rejects(
    api.transacao({ pessoaId: ids.ana }, (tx) => tx.consultar("update pessoa set email_hash = '\\x00' where id = $1", [ids.ana])),
    /permission denied/,
  );
});

test('auditoria encadeia, não aceita alteração e detecta adulteração', async () => {
  for (const acao of ['conta.criada', 'checkin.manual', 'conta.exportada']) {
    await api.transacao({ pessoaId: ids.ana, eventoId: ids.eventoA }, (tx) =>
      tx.consultar('insert into auditoria (evento_id, ator_id, acao, dados) values ($1, $2, $3, $4)', [ids.eventoA, ids.ana, acao, { origem: 'teste' }]));
  }
  const cadeia = (await b.dono.query<{ anterior: Buffer; hash: Buffer }>('select hash_anterior as anterior, hash from auditoria order by id')).rows;
  assert.equal(cadeia.length, 3);
  const [a, c, d] = cadeia.map((l) => l);
  assert.ok(a && c && d && c.anterior.equals(a.hash) && d.anterior.equals(c.hash));
  assert.equal((await b.dono.query('select auditoria_verificar() as v')).rows[0].v, null);

  // Nem o dono altera ou apaga pela via normal.
  await assert.rejects(b.dono.query("update auditoria set acao = 'outra'"), /só de inserção/);
  await assert.rejects(b.dono.query('delete from auditoria'), /só de inserção/);
  await assert.rejects(b.dono.query('truncate auditoria'), /só de inserção/);

  // Adulteração por fora (desligando o gatilho) é detectada na verificação.
  await b.dono.query('alter table auditoria disable trigger auditoria_imutavel');
  const { rows } = await b.dono.query<{ id: string }>("update auditoria set dados = '{\"origem\":\"forjado\"}' where acao = 'checkin.manual' returning id");
  await b.dono.query('alter table auditoria enable trigger auditoria_imutavel');
  assert.equal((await b.dono.query('select auditoria_verificar()::text as v')).rows[0].v, primeira(rows).id);
});

test('ninguém registra auditoria em nome de outra pessoa', async () => {
  await assert.rejects(
    api.transacao({ pessoaId: ids.ana }, (tx) =>
      tx.consultar("insert into auditoria (ator_id, acao) values ($1, 'conta.criada')", [ids.bia])),
    /row-level security/,
  );
});

test('a auditoria do evento só é lida pelo admin daquele evento', async () => {
  const ler = (pessoaId: string, eventoId: string) =>
    api.transacao({ pessoaId, eventoId }, (tx) => tx.consultar('select id from auditoria'));
  assert.ok((await ler(ids.ana, ids.eventoA)).length > 0);
  assert.equal((await ler(ids.caio, ids.eventoA)).length, 0);
  assert.equal((await ler(ids.bia, ids.eventoA)).length, 0);
});

test('o contexto recusa id que não é UUID', async () => {
  await assert.rejects(api.transacao({ pessoaId: "x' or 1=1" }, async () => undefined), /id inválido/);
});

/**
 * Feature 07 no banco, com o papel real da API (app_api): organização acima do
 * evento, vários papéis por pessoa, convite e isolamento entre organizações (ADR 0025).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { criarBancoDeTeste, PASTA_MIGRACOES } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { lerMigracoes, migrar } from '../../src/shared/db/migrador.ts';

let b: BancoDeTeste;
let api: Banco;
const ids = {} as Record<'ana' | 'bia' | 'caio' | 'duda' | 'orgA' | 'orgB' | 'eventoA' | 'eventoB', string>;
const hash = (n: number) => Buffer.alloc(32, n);

const um = <T>(linhas: readonly T[]): T => {
  const [linha] = linhas;
  if (linha === undefined) throw new Error('consulta sem linhas');
  return linha;
};
const como = <T extends pg.QueryResultRow>(pessoaId: string, sql: string, valores: unknown[] = []) =>
  api.transacao({ pessoaId }, (tx) => tx.consultar<T>(sql, valores));

before(async () => {
  b = await criarBancoDeTeste();
  api = new Banco({ url: b.url, papel: 'app_api' });
  const pessoa = async (n: number) => um((await b.dono.query<{ id: string }>(
    'insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id',
    [Buffer.from('cifrado'), hash(n), `p${n}`])).rows).id;
  ids.ana = await pessoa(1);
  ids.bia = await pessoa(2);
  ids.caio = await pessoa(3);
  ids.duda = await pessoa(4);
});

after(async () => {
  await api.fechar();
  await b.apagar();
});

test('quem cria a organização vira dono e só ela enxerga', async () => {
  ids.orgA = um(await como<{ id: string }>(ids.ana, "select criar_organizacao('Sociedade A', '12345678000190') as id")).id;
  ids.orgB = um(await como<{ id: string }>(ids.bia, "select criar_organizacao('Sociedade B') as id")).id;
  const daAna = await como<{ nome: string }>(ids.ana, 'select nome from organizacao');
  assert.deepEqual(daAna, [{ nome: 'Sociedade A' }]);
  const papeis = await como<{ papel: string }>(ids.ana, 'select papel from organizacao_membro');
  assert.deepEqual(papeis, [{ papel: 'dono' }]);
  assert.deepEqual(await como(ids.caio, 'select 1 from organizacao'), []);
  await assert.rejects(api.transacao({}, (tx) => tx.consultar("select criar_organizacao('Sem dono')")), /sem pessoa no contexto/);
});

test('dono cria evento na própria organização e nunca na dos outros', async () => {
  const novo = (org: string, slug: string) =>
    "insert into evento (organizacao_id, slug, nome, inicio, fim, local) values " +
    `('${org}', '${slug}', 'Evento', '2027-03-01', '2027-03-03', 'Fortaleza') returning id`;
  ids.eventoA = um(await como<{ id: string }>(ids.ana, novo(ids.orgA, 'evento-a'))).id;
  ids.eventoB = um(await como<{ id: string }>(ids.bia, novo(ids.orgB, 'evento-b'))).id;
  await assert.rejects(como(ids.ana, novo(ids.orgB, 'invasor')), /row-level security/);
  await assert.rejects(como(ids.caio, novo(ids.orgA, 'sem-papel')), /row-level security/);
  // Rascunho: a dona vê o seu, não o da outra organização.
  const vistos = await como<{ slug: string }>(ids.ana, 'select slug from evento');
  assert.deepEqual(vistos, [{ slug: 'evento-a' }]);
});

test('dono da organização vale como qualquer papel nos eventos dela, e só neles', async () => {
  const r = um(await como<{ a: boolean; b: boolean }>(ids.ana,
    "select tem_papel($1, array['financeiro']) as a, tem_papel($2, array['admin']) as b", [ids.eventoA, ids.eventoB]));
  assert.deepEqual(r, { a: true, b: false });
});

test('uma pessoa acumula papéis no mesmo evento', async () => {
  await como(ids.ana, "insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'conteudo'), ($1, $2, 'operacao')", [ids.eventoA, ids.caio]);
  const papeis = await como<{ papel: string }>(ids.caio, 'select papel from membro_organizacao order by papel');
  assert.deepEqual(papeis.map((p) => p.papel), ['conteudo', 'operacao']);
  // Papel novo enxerga o rascunho; papel que não existe é recusado pelo banco.
  assert.deepEqual(await como(ids.caio, 'select slug from evento'), [{ slug: 'evento-a' }]);
  await assert.rejects(como(ids.ana, "insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'chefe')", [ids.eventoA, ids.caio]), /papel_check/);
  // Equipe de um evento não gerencia a equipe de outro.
  await assert.rejects(como(ids.ana, "insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'admin')", [ids.eventoB, ids.caio]), /row-level security/);
});

test('mesa organizadora: cargo e exibição pública são do admin', async () => {
  const feitos = await como(ids.ana, "update membro_organizacao set cargo = 'Coordenação científica', exibir_publico = true where pessoa_id = $1 and papel = 'conteudo' returning cargo", [ids.caio]);
  assert.deepEqual(feitos, [{ cargo: 'Coordenação científica' }]);
  assert.deepEqual(await como(ids.caio, "update membro_organizacao set cargo = 'Presidente' where pessoa_id = $1 returning cargo", [ids.caio]), []);
});

test('convite de evento: só o convidado aceita, e os papéis entram de uma vez', async () => {
  const convite = um(await como<{ id: string }>(ids.ana,
    `insert into convite (organizacao_id, evento_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, $4, array['credenciamento', 'acessibilidade'], $5) returning id`,
    [ids.orgA, ids.eventoA, Buffer.from('cifrado'), hash(4), ids.ana])).id;
  // Outra pessoa não vê nem aceita.
  assert.deepEqual(await como(ids.caio, 'select * from meus_convites()'), []);
  assert.deepEqual(await como(ids.caio, 'select aceitar_convite($1) as ok', [convite]), [{ ok: false }]);
  const pendentes = await como<{ organizacao: string; evento: string; papeis: string[] }>(ids.duda, 'select organizacao, evento, papeis from meus_convites()');
  assert.deepEqual(pendentes, [{ organizacao: 'Sociedade A', evento: 'Evento', papeis: ['credenciamento', 'acessibilidade'] }]);
  assert.deepEqual(await como(ids.duda, 'select aceitar_convite($1) as ok', [convite]), [{ ok: true }]);
  // Aceitar duas vezes não duplica nem reabre.
  assert.deepEqual(await como(ids.duda, 'select aceitar_convite($1) as ok', [convite]), [{ ok: false }]);
  const papeis = await como<{ papel: string }>(ids.duda, 'select papel from membro_organizacao order by papel');
  assert.deepEqual(papeis.map((p) => p.papel), ['acessibilidade', 'credenciamento']);
});

test('convite revogado ou vencido não vale; convite não cruza organizações', async () => {
  const criar = (extra = '') => como<{ id: string }>(ids.ana,
    `insert into convite (organizacao_id, evento_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, $4, array['comercial'], $5) returning id ${extra}`,
    [ids.orgA, ids.eventoA, Buffer.from('cifrado'), hash(3), ids.ana]);
  const revogado = um(await criar()).id;
  await como(ids.ana, 'update convite set revogado_em = now() where id = $1', [revogado]);
  assert.deepEqual(await como(ids.caio, 'select aceitar_convite($1) as ok', [revogado]), [{ ok: false }]);
  const vencido = um(await criar()).id;
  await b.dono.query("update convite set expira_em = now() - interval '1 minute' where id = $1", [vencido]);
  assert.deepEqual(await como(ids.caio, 'select aceitar_convite($1) as ok', [vencido]), [{ ok: false }]);
  // A dona de A não convida para o evento de B, nem com a organização trocada.
  await assert.rejects(como(ids.ana,
    `insert into convite (organizacao_id, evento_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, $4, array['admin'], $5)`, [ids.orgB, ids.eventoB, Buffer.from('c'), hash(3), ids.ana]), /row-level security/);
  await assert.rejects(como(ids.ana,
    `insert into convite (organizacao_id, evento_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, $4, array['admin'], $5)`, [ids.orgA, ids.eventoB, Buffer.from('c'), hash(3), ids.ana]), /row-level security|não pertence/);
  // Papel de organização não cabe em convite de evento.
  await assert.rejects(como(ids.ana,
    `insert into convite (organizacao_id, evento_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, $4, array['dono'], $5)`, [ids.orgA, ids.eventoA, Buffer.from('c'), hash(3), ids.ana]), /convite_check/);
  assert.deepEqual(await como(ids.bia, 'select 1 from convite'), []);
});

test('convite de organização: só o dono convida; o admin aceito enxerga todos os eventos', async () => {
  const convite = um(await como<{ id: string }>(ids.ana,
    `insert into convite (organizacao_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, array['admin'], $4) returning id`, [ids.orgA, Buffer.from('c'), hash(3), ids.ana])).id;
  assert.deepEqual(await como(ids.caio, 'select aceitar_convite($1) as ok', [convite]), [{ ok: true }]);
  assert.deepEqual(um(await como<{ ok: boolean }>(ids.caio, "select tem_papel($1, array['financeiro']) as ok", [ids.eventoA])), { ok: true });
  // Admin não nomeia dono nem outro admin: isso é do dono.
  await assert.rejects(como(ids.caio, "insert into organizacao_membro (organizacao_id, pessoa_id, papel) values ($1, $2, 'admin')", [ids.orgA, ids.duda]), /row-level security/);
  await assert.rejects(como(ids.caio,
    `insert into convite (organizacao_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, array['admin'], $4)`, [ids.orgA, Buffer.from('c'), hash(4), ids.caio]), /row-level security/);
});

test('evento de demonstração fica fora da vitrine mesmo publicado', async () => {
  await b.dono.query('update evento set publicado = true where id = any ($1)', [[ids.eventoA, ids.eventoB]]);
  await b.dono.query('update evento set demonstracao = true where id = $1', [ids.eventoB]);
  const anonimo = await api.transacao({}, (tx) => tx.consultar<{ slug: string }>('select slug from evento'));
  assert.deepEqual(anonimo, [{ slug: 'evento-a' }]);
  assert.deepEqual(await como(ids.bia, "select slug from evento where slug = 'evento-b'"), [{ slug: 'evento-b' }]);
});

test('migração 0010 em banco da v1.0.0: cada evento ganha organização e o admin mais antigo vira dono', async () => {
  const antigo = await criarBancoDeTeste({ migrar: false });
  try {
    const todas = lerMigracoes(PASTA_MIGRACOES);
    await migrar(antigo.dono, todas.filter((m) => m.versao < '0010'));
    const { rows: [ev] } = await antigo.dono.query<{ id: string }>(
      "insert into evento (slug, nome, inicio, fim, local, publicado) values ('legado', 'Evento legado', '2026-07-01', '2026-07-03', 'Fortaleza', true) returning id");
    const pessoa = async (n: number) => um((await antigo.dono.query<{ id: string }>(
      'insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id', [Buffer.from('c'), hash(n), `p${n}`])).rows).id;
    const [primeira, segunda, terceira] = [await pessoa(1), await pessoa(2), await pessoa(3)];
    await antigo.dono.query(
      `insert into membro_organizacao (evento_id, pessoa_id, papel, criado_em) values
         ($1, $2, 'admin', '2026-01-01'), ($1, $3, 'admin', '2026-02-01'), ($1, $4, 'credenciamento', '2025-01-01')`,
      [ev?.id, primeira, segunda, terceira]);
    await migrar(antigo.dono, todas);
    const { rows } = await antigo.dono.query<{ nome: string; pessoa_id: string; papel: string }>(
      `select o.nome, m.pessoa_id, m.papel from evento e join organizacao o on o.id = e.organizacao_id
       join organizacao_membro m on m.organizacao_id = o.id where e.slug = 'legado' order by m.papel desc`);
    assert.deepEqual(rows, [
      { nome: 'Evento legado', pessoa_id: primeira, papel: 'dono' },
      { nome: 'Evento legado', pessoa_id: segunda, papel: 'admin' },
    ]);
    // A equipe do evento continua como estava.
    const { rows: [n] } = await antigo.dono.query<{ n: number }>('select count(*)::int as n from membro_organizacao');
    assert.equal(n?.n, 3);
  } finally {
    await antigo.apagar();
  }
});

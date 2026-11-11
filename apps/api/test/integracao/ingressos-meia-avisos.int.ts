/**
 * Feature 09 no banco, com o papel real da API (app_api): modalidade do ingresso,
 * meia-entrada declarada, acompanhante, taxa e avisos por categoria (ADR 0027).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';

let b: BancoDeTeste;
let api: Banco;
const ids = {} as Record<'ana' | 'bia' | 'gil' | 'com' | 'caio' | 'duda' | 'eva' | 'eventoA' | 'eventoB' | 'meia', string>;

const um = <T>(linhas: readonly T[]): T => {
  const [linha] = linhas;
  if (linha === undefined) throw new Error('consulta sem linhas');
  return linha;
};
const como = <T extends pg.QueryResultRow>(pessoaId: string, sql: string, valores: unknown[] = []) =>
  api.transacao({ pessoaId }, (tx) => tx.consultar<T>(sql, valores));
const dono = async <T extends pg.QueryResultRow>(sql: string, valores: unknown[] = []) => (await b.dono.query<T>(sql, valores)).rows;

async function emitirIngresso(evento: string, pessoa: string, tipo: string, acompanha: string | null = null): Promise<string> {
  const pedido = um(await dono<{ id: string }>(
    `insert into pedido (pessoa_id, evento_id, tipo_ingresso_id, chave_idempotencia, valor_centavos, taxa_centavos, metodo, status)
     values ($1, $2, $3, $4, 5000, 400, 'pix', 'aprovado') returning id`, [pessoa, evento, tipo, randomUUID()])).id;
  return um(await dono<{ id: string }>(
    'insert into ingresso (pedido_id, pessoa_id, evento_id, tipo_ingresso_id, acompanha_ingresso_id) values ($1, $2, $3, $4, $5) returning id',
    [pedido, pessoa, evento, tipo, acompanha])).id;
}

before(async () => {
  b = await criarBancoDeTeste();
  api = new Banco({ url: b.url, papel: 'app_api' });
  const pessoa = async (n: number, nome: string) => um(await dono<{ id: string }>(
    'insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id', [Buffer.from('c'), Buffer.alloc(32, n), nome])).id;
  ids.ana = await pessoa(1, 'Ana');   // dona de A
  ids.bia = await pessoa(2, 'Bia');   // dona de B
  ids.gil = await pessoa(3, 'Gil');   // credenciamento em A
  ids.com = await pessoa(4, 'Com');   // comunicação em A
  ids.caio = await pessoa(5, 'Caio'); // congressista com meia
  ids.duda = await pessoa(6, 'Duda'); // acompanhante
  ids.eva = await pessoa(7, 'Eva');   // palestrante
  const orgA = um(await como<{ id: string }>(ids.ana, "select criar_organizacao('Sociedade A') as id")).id;
  const orgB = um(await como<{ id: string }>(ids.bia, "select criar_organizacao('Sociedade B') as id")).id;
  const evento = async (org: string, slug: string) => um(await dono<{ id: string }>(
    "insert into evento (organizacao_id, slug, nome, inicio, fim, local, publicado) values ($1, $2, $2, '2027-03-01', '2027-03-03T18:00:00Z', 'Fortaleza', true) returning id", [org, slug])).id;
  ids.eventoA = await evento(orgA, 'evento-a');
  ids.eventoB = await evento(orgB, 'evento-b');
  await dono("insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'credenciamento'), ($1, $3, 'comunicacao')", [ids.eventoA, ids.gil, ids.com]);
});

after(async () => {
  await api.fechar();
  await b.apagar();
});

test('tipo de ingresso ganha modalidade e a escolha de mostrar o saldo', async () => {
  const tipo = um(await como<{ id: string; modalidade: string; publico_ve_saldo: boolean }>(ids.ana,
    "insert into tipo_ingresso (evento_id, nome, preco_centavos, vagas) values ($1, 'Congressista', 10000, 100) returning id, modalidade, publico_ve_saldo", [ids.eventoA]));
  assert.deepEqual({ modalidade: tipo.modalidade, saldo: tipo.publico_ve_saldo }, { modalidade: 'inteira', saldo: true });
  ids.meia = um(await como<{ id: string }>(ids.ana,
    "insert into tipo_ingresso (evento_id, nome, preco_centavos, vagas, modalidade, publico_ve_saldo) values ($1, 'Meia', 5000, 40, 'meia', false) returning id", [ids.eventoA])).id;
  await assert.rejects(como(ids.ana, "update tipo_ingresso set modalidade = 'vip' where id = $1", [ids.meia]), /modalidade_check/);
});

test('meia-entrada: a pessoa declara, a equipe confere, ninguém de fora lê o motivo', async () => {
  await como(ids.caio, "insert into elegibilidade_meia (evento_id, pessoa_id, motivo) values ($1, $2, 'pcd')", [ids.eventoA, ids.caio]);
  const propria = um(await como<{ motivo: string; apagar_apos: string }>(ids.caio, "select motivo, apagar_apos::text from elegibilidade_meia"));
  assert.deepEqual(propria, { motivo: 'pcd', apagar_apos: '2027-04-02' });
  // Não declara em nome de outro, nem já "conferida", nem motivo inventado.
  await assert.rejects(como(ids.caio, "insert into elegibilidade_meia (evento_id, pessoa_id, motivo) values ($1, $2, 'idoso')", [ids.eventoA, ids.duda]), /row-level security/);
  await assert.rejects(como(ids.duda, "insert into elegibilidade_meia (evento_id, pessoa_id, motivo, resultado) values ($1, $2, 'idoso', 'confirmada')", [ids.eventoA, ids.duda]), /permission denied/);
  await assert.rejects(como(ids.duda, "insert into elegibilidade_meia (evento_id, pessoa_id, motivo) values ($1, $2, 'amigo')", [ids.eventoA, ids.duda]), /motivo_check/);
  // Motivo é dado sensível: comunicação e outra organização não leem.
  assert.deepEqual(await como(ids.com, 'select 1 from elegibilidade_meia'), []);
  assert.deepEqual(await como(ids.bia, 'select 1 from elegibilidade_meia'), []);
  assert.equal((await como(ids.gil, 'select 1 from elegibilidade_meia')).length, 1);
  // Conferir: só a equipe de portão, assinando com o próprio nome.
  assert.deepEqual(await como(ids.com, "update elegibilidade_meia set conferida_em = now(), conferida_por = $1, resultado = 'confirmada' returning id", [ids.com]), []);
  await assert.rejects(como(ids.gil, "update elegibilidade_meia set conferida_em = now(), conferida_por = $1, resultado = 'confirmada'", [ids.ana]), /row-level security/);
  await assert.rejects(como(ids.gil, "update elegibilidade_meia set motivo = 'idoso'"), /permission denied/);
  assert.equal((await como(ids.gil, "update elegibilidade_meia set conferida_em = now(), conferida_por = $1, resultado = 'confirmada' returning id", [ids.gil])).length, 1);
  // Depois de conferida, a pessoa não apaga.
  assert.deepEqual(await como(ids.caio, 'delete from elegibilidade_meia returning id'), []);
});

test('expurgo apaga as declarações 30 dias após o evento', async () => {
  await como(ids.duda, "insert into elegibilidade_meia (evento_id, pessoa_id, motivo) values ($1, $2, 'acompanhante_pcd')", [ids.eventoA, ids.duda]);
  await dono("update elegibilidade_meia set apagar_apos = current_date - 1 where pessoa_id = $1", [ids.duda]);
  assert.deepEqual(await api.transacao({}, (tx) => tx.consultar('select expurgar_meia() as n')), [{ n: 1 }]);
  assert.equal((await dono('select 1 from elegibilidade_meia')).length, 1);
});

test('acompanhante aponta para o ingresso de quem acompanha; o pedido guarda a taxa', async () => {
  const titular = await emitirIngresso(ids.eventoA, ids.caio, ids.meia);
  const acompanhante = await emitirIngresso(ids.eventoA, ids.duda, ids.meia, titular);
  const visto = um(await como<{ acompanha_ingresso_id: string }>(ids.duda, 'select acompanha_ingresso_id from ingresso'));
  assert.equal(visto.acompanha_ingresso_id, titular);
  await assert.rejects(dono('update ingresso set acompanha_ingresso_id = id where id = $1', [acompanhante]), /nao_acompanha_a_si/);
  assert.deepEqual(await como(ids.caio, 'select taxa_centavos from pedido'), [{ taxa_centavos: 400 }]);
});

test('atividade ganha tipo e zona; palestrante pode ter conta', async () => {
  const zona = um(await dono<{ id: string }>("insert into zona (evento_id, nome, aberta) values ($1, 'Área externa', true) returning id", [ids.eventoA])).id;
  const festa = um(await como<{ tipo: string }>(ids.ana,
    "insert into atividade (evento_id, titulo, inicio, fim, tipo, zona_id) values ($1, 'Festa de abertura', '2027-03-01T22:00:00Z', '2027-03-02T02:00:00Z', 'festa', $2) returning tipo", [ids.eventoA, zona]));
  assert.equal(festa.tipo, 'festa');
  const p = um(await como<{ pessoa_id: string }>(ids.ana, "insert into palestrante (evento_id, nome, pessoa_id) values ($1, 'Eva Lima', $2) returning pessoa_id", [ids.eventoA, ids.eva]));
  assert.equal(p.pessoa_id, ids.eva);
});

test('aviso: comunicação publica; cada um lê o da sua categoria, na hora marcada', async () => {
  const avisar = (quem: string, titulo: string, categorias: string[] | null, publicarEm = 'now()', evento = ids.eventoA) => como(quem,
    `insert into aviso (evento_id, titulo, corpo, categorias, publicar_em, criado_por) values ($1, $2, 'Corpo do aviso', $3, ${publicarEm}, $4)`, [evento, titulo, categorias, quem]);
  await avisar(ids.com, 'Para todos', null);
  await avisar(ids.com, 'Só palestrantes', ['palestrante']);
  await avisar(ids.com, 'Amanhã', null, "now() + interval '1 day'");
  await dono("insert into credencial (evento_id, pessoa_id, categoria) values ($1, $2, 'palestrante')", [ids.eventoA, ids.eva]);
  const titulos = async (quem: string) => (await como<{ titulo: string }>(quem, 'select titulo from aviso order by titulo')).map((a) => a.titulo);
  assert.deepEqual(await titulos(ids.caio), ['Para todos']);                       // congressista
  assert.deepEqual(await titulos(ids.eva), ['Para todos', 'Só palestrantes']);     // palestrante
  assert.deepEqual(await titulos(ids.com), ['Amanhã', 'Para todos', 'Só palestrantes']); // equipe vê os agendados
  assert.deepEqual(await titulos(ids.bia), []);                                    // outra organização
  // Credencial revogada deixa de receber.
  await dono('update credencial set revogada_em = now() where pessoa_id = $1', [ids.eva]);
  assert.deepEqual(await titulos(ids.eva), []);
  // Quem não é de comunicação não publica; ninguém publica no evento alheio nem assina por outro.
  await assert.rejects(avisar(ids.gil, 'Do portão', null), /row-level security/);
  await assert.rejects(avisar(ids.com, 'Invasor', null, 'now()', ids.eventoB), /row-level security/);
  await assert.rejects(como(ids.com, "insert into aviso (evento_id, titulo, corpo, criado_por) values ($1, 'Em nome de outro', 'Corpo', $2)", [ids.eventoA, ids.ana]), /row-level security/);
  await assert.rejects(avisar(ids.com, 'Categoria errada', ['penetra']), /categoria_pessoa/);
});

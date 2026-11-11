/**
 * Feature 08 no banco, com o papel real da API (app_api): local, zonas, regras por
 * categoria, credencial, pontos de leitura e check-in por credencial (ADR 0026).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { criarBancoDeTeste, PASTA_MIGRACOES } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { lerMigracoes, migrar } from '../../src/shared/db/migrador.ts';

let b: BancoDeTeste;
let api: Banco;
type Nome = 'ana' | 'bia' | 'gil' | 'opa' | 'caio' | 'duda' | 'eva' | 'orgA' | 'orgB' | 'eventoA' | 'eventoB'
  | 'ingresso' | 'credCaio' | 'credDuda' | 'geral' | 'vip' | 'palco' | 'zonaB' | 'portao' | 'pontoVip' | 'local';
const ids = {} as Record<Nome, string>;
const hash = (n: number) => Buffer.alloc(32, n);

const um = <T>(linhas: readonly T[]): T => {
  const [linha] = linhas;
  if (linha === undefined) throw new Error('consulta sem linhas');
  return linha;
};
const como = <T extends pg.QueryResultRow>(pessoaId: string, sql: string, valores: unknown[] = []) =>
  api.transacao({ pessoaId }, (tx) => tx.consultar<T>(sql, valores));
const dono = async <T extends pg.QueryResultRow>(sql: string, valores: unknown[] = []) => (await b.dono.query<T>(sql, valores)).rows;

/** Monta pedido aprovado e ingresso como dono do esquema; devolve o id do ingresso. */
async function emitirIngresso(cliente: pg.ClientBase, evento: string, pessoa: string): Promise<string> {
  const { rows: [tipo] } = await cliente.query<{ id: string }>(
    "insert into tipo_ingresso (evento_id, nome, preco_centavos, vagas) values ($1, 'Congressista ' || $2, 10000, 100) returning id", [evento, randomUUID().slice(0, 8)]);
  const { rows: [pedido] } = await cliente.query<{ id: string }>(
    `insert into pedido (pessoa_id, evento_id, tipo_ingresso_id, chave_idempotencia, valor_centavos, metodo, status)
     values ($1, $2, $3, $4, 10000, 'pix', 'aprovado') returning id`, [pessoa, evento, tipo?.id, randomUUID()]);
  const { rows: [ingresso] } = await cliente.query<{ id: string }>(
    'insert into ingresso (pedido_id, pessoa_id, evento_id, tipo_ingresso_id) values ($1, $2, $3, $4) returning id', [pedido?.id, pessoa, evento, tipo?.id]);
  if (!ingresso) throw new Error('ingresso não emitido');
  return ingresso.id;
}

before(async () => {
  b = await criarBancoDeTeste();
  api = new Banco({ url: b.url, papel: 'app_api' });
  const pessoa = async (n: number, nome: string) => um(await dono<{ id: string }>(
    'insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id', [Buffer.from('c'), hash(n), nome])).id;
  ids.ana = await pessoa(1, 'Ana');   // dona da organização A
  ids.bia = await pessoa(2, 'Bia');   // dona da organização B
  ids.gil = await pessoa(3, 'Gil');   // credenciamento em A
  ids.opa = await pessoa(4, 'Opa');   // operação em A
  ids.caio = await pessoa(5, 'Caio'); // congressista em A
  ids.duda = await pessoa(6, 'Duda'); // segurança em A
  ids.eva = await pessoa(7, 'Eva');   // ninguém
  ids.orgA = um(await como<{ id: string }>(ids.ana, "select criar_organizacao('Sociedade A') as id")).id;
  ids.orgB = um(await como<{ id: string }>(ids.bia, "select criar_organizacao('Sociedade B') as id")).id;
  const evento = async (org: string, slug: string) => um(await dono<{ id: string }>(
    "insert into evento (organizacao_id, slug, nome, inicio, fim, local, publicado) values ($1, $2, $2, '2027-03-01', '2027-03-03', 'Fortaleza', true) returning id", [org, slug])).id;
  ids.eventoA = await evento(ids.orgA, 'evento-a');
  ids.eventoB = await evento(ids.orgB, 'evento-b');
  await dono("insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'credenciamento'), ($1, $3, 'operacao')", [ids.eventoA, ids.gil, ids.opa]);
  ids.zonaB = um(await dono<{ id: string }>("insert into zona (evento_id, nome) values ($1, 'Camarim B') returning id", [ids.eventoB])).id;
});

after(async () => {
  await api.fechar();
  await b.apagar();
});

test('local é da organização: quem gere cria, o público vê pelo evento, a vizinha não altera', async () => {
  ids.local = um(await como<{ id: string }>(ids.ana,
    "insert into local (organizacao_id, nome, cidade, uf, acessibilidade) values ($1, 'Centro de Eventos', 'Fortaleza', 'CE', 'Rampa pela entrada leste') returning id", [ids.orgA])).id;
  await como(ids.ana, 'update evento set local_id = $1 where id = $2', [ids.local, ids.eventoA]);
  const publico = await api.transacao({}, (tx) => tx.consultar<{ nome: string }>('select nome from local'));
  assert.deepEqual(publico, [{ nome: 'Centro de Eventos' }]);
  assert.deepEqual(await como(ids.bia, "update local set nome = 'Tomado' where id = $1 returning id", [ids.local]), []);
  await assert.rejects(como(ids.bia, "insert into local (organizacao_id, nome) values ($1, 'Invasor')", [ids.orgA]), /row-level security/);
  await assert.rejects(como(ids.gil, "insert into local (organizacao_id, nome) values ($1, 'Sem papel')", [ids.orgA]), /row-level security/);
});

test('zonas e regras: operação monta, credenciamento só lê, outra organização não toca', async () => {
  const zona = async (nome: string, aberta = false) => um(await como<{ id: string }>(ids.opa,
    'insert into zona (evento_id, nome, aberta) values ($1, $2, $3) returning id', [ids.eventoA, nome, aberta])).id;
  ids.geral = await zona('Área geral', true);
  ids.vip = await zona('Sala VIP');
  ids.palco = await zona('Bastidores');
  await como(ids.opa, "insert into regra_zona (zona_id, evento_id, categoria) values ($1, $3, 'palestrante'), ($2, $3, 'seguranca')", [ids.vip, ids.palco, ids.eventoA]);
  await como(ids.opa, "insert into regra_zona (zona_id, evento_id, categoria, de, ate) values ($1, $2, 'montagem', '2027-02-27', '2027-03-01')", [ids.palco, ids.eventoA]);
  await assert.rejects(como(ids.gil, "insert into zona (evento_id, nome) values ($1, 'Do portão')", [ids.eventoA]), /row-level security/);
  await assert.rejects(como(ids.bia, "insert into regra_zona (zona_id, evento_id, categoria) values ($1, $2, 'convidado')", [ids.vip, ids.eventoA]), /row-level security/);
  // Regra não aponta para zona de outro evento, nem para categoria fora da lista.
  await assert.rejects(como(ids.opa, "insert into regra_zona (zona_id, evento_id, categoria) values ($1, $2, 'convidado')", [ids.zonaB, ids.eventoA]), /foreign key/);
  await assert.rejects(como(ids.opa, "insert into regra_zona (zona_id, evento_id, categoria) values ($1, $2, 'penetra')", [ids.vip, ids.eventoA]), /categoria_pessoa/);
  // O participante vê o mapa (zonas), não as regras.
  assert.equal((await como(ids.eva, 'select 1 from zona where evento_id = $1', [ids.eventoA])).length, 3);
  assert.deepEqual(await como(ids.eva, 'select 1 from regra_zona'), []);
  assert.equal((await como(ids.gil, 'select 1 from regra_zona')).length, 3);
  assert.deepEqual(await como(ids.bia, 'select 1 from regra_zona where evento_id = $1', [ids.eventoA]), []);
});

test('sala ganha zona, capacidade e lugares reservados', async () => {
  const sala = um(await como<{ lugares_reservados: number }>(ids.ana,
    "insert into sala (evento_id, nome, local, zona_id, capacidade, lugares_reservados) values ($1, 'Auditório', 'Térreo', $2, 300, 8) returning lugares_reservados", [ids.eventoA, ids.geral]));
  assert.equal(sala.lugares_reservados, 8);
  await assert.rejects(como(ids.ana, "insert into sala (evento_id, nome, local, capacidade) values ($1, 'Vazia', 'Térreo', 0)", [ids.eventoA]), /capacidade_check/);
});

test('todo ingresso gera credencial de congressista; cancelar o ingresso revoga', async () => {
  ids.ingresso = await emitirIngresso(b.dono, ids.eventoA, ids.caio);
  const cred = um(await como<{ id: string; categoria: string; revogada_em: Date | null }>(ids.caio, 'select id, categoria, revogada_em from credencial'));
  assert.equal(cred.categoria, 'congressista');
  assert.equal(cred.revogada_em, null);
  ids.credCaio = cred.id;
  // Outro ingresso, cancelado: a credencial acompanha, e reativar devolve.
  const outro = await emitirIngresso(b.dono, ids.eventoA, ids.eva);
  await dono('update ingresso set cancelado_em = now() where id = $1', [outro]);
  assert.equal(um(await dono<{ motivo: string }>('select motivo from credencial where ingresso_id = $1 and revogada_em is not null', [outro])).motivo, 'ingresso cancelado');
  await dono('update ingresso set cancelado_em = null where id = $1', [outro]);
  assert.equal((await dono('select 1 from credencial where ingresso_id = $1 and revogada_em is null', [outro])).length, 1);
  await dono('delete from ingresso where id = $1', [outro]);
});

test('credencial sem ingresso: operação emite, uma ativa por categoria, nunca de congressista', async () => {
  const emitir = (quem: string, categoria: string, evento = ids.eventoA, pessoa = ids.duda) => como<{ id: string }>(quem,
    'insert into credencial (evento_id, pessoa_id, categoria, emitida_por) values ($1, $2, $3, $4) returning id', [evento, pessoa, categoria, quem]);
  ids.credDuda = um(await emitir(ids.opa, 'seguranca')).id;
  await assert.rejects(emitir(ids.opa, 'seguranca'), /credencial_unica_ativa/);
  await assert.rejects(emitir(ids.opa, 'congressista'), /credencial_check/);
  await assert.rejects(emitir(ids.gil, 'convidado'), /row-level security/);
  await assert.rejects(emitir(ids.bia, 'convidado'), /row-level security/);
  await assert.rejects(emitir(ids.ana, 'convidado', ids.eventoB), /row-level security/);
  // A mesma pessoa pode ter outra categoria no mesmo evento.
  const extra = um(await emitir(ids.ana, 'palestrante')).id;
  await como(ids.ana, "update credencial set revogada_em = now(), revogada_por = $2, motivo = 'emitida por engano' where id = $1", [extra, ids.ana]);
  // Cada um vê a sua; a equipe de portão vê as do evento; a vizinha, nenhuma.
  assert.equal((await como(ids.duda, 'select 1 from credencial')).length, 2);
  assert.equal((await como(ids.gil, 'select 1 from credencial')).length, 3);
  assert.deepEqual(await como(ids.bia, 'select 1 from credencial'), []);
  assert.deepEqual(await como(ids.gil, "update credencial set revogada_em = now() where id = $1 returning id", [ids.credDuda]), []);
});

test('pode_entrar: zona aberta, regra por categoria, janela de horário e exceção pessoal', async () => {
  const pode = async (credencial: string, zona: string | null, quando = '2027-03-01T12:00:00Z') =>
    um(await como<{ ok: boolean }>(ids.gil, 'select pode_entrar($1, $2, $3) as ok', [credencial, zona, quando])).ok;
  assert.equal(await pode(ids.credCaio, null), true);        // entrada do evento
  assert.equal(await pode(ids.credCaio, ids.geral), true);   // zona aberta
  assert.equal(await pode(ids.credCaio, ids.vip), false);    // sem regra para congressista
  assert.equal(await pode(ids.credDuda, ids.palco), true);   // segurança nos bastidores
  assert.equal(await pode(ids.credDuda, ids.vip), false);
  assert.equal(await pode(ids.credCaio, ids.zonaB), false);  // zona de outro evento
  // Exceção pessoal ganha da regra, nos dois sentidos.
  await como(ids.opa, "insert into credencial_excecao (credencial_id, zona_id, evento_id, efeito, motivo, criado_por) values ($1, $2, $3, 'permite', 'Homenageado da noite', $4)", [ids.credCaio, ids.vip, ids.eventoA, ids.opa]);
  await como(ids.opa, "insert into credencial_excecao (credencial_id, zona_id, evento_id, efeito, motivo, criado_por) values ($1, $2, $3, 'nega', 'Fora da escala', $4)", [ids.credDuda, ids.palco, ids.eventoA, ids.opa]);
  assert.equal(await pode(ids.credCaio, ids.vip), true);
  assert.equal(await pode(ids.credDuda, ids.palco), false);
  await assert.rejects(como(ids.gil, "insert into credencial_excecao (credencial_id, zona_id, evento_id, efeito, motivo, criado_por) values ($1, $2, $3, 'permite', 'Amigo meu', $4)", [ids.credDuda, ids.vip, ids.eventoA, ids.gil]), /row-level security/);
  // Janela: montagem entra antes da abertura, não durante.
  const montador = um(await como<{ id: string }>(ids.opa, "insert into credencial (evento_id, pessoa_id, categoria, emitida_por) values ($1, $2, 'montagem', $3) returning id", [ids.eventoA, ids.eva, ids.opa])).id;
  assert.equal(await pode(montador, ids.palco, '2027-02-28T10:00:00Z'), true);
  assert.equal(await pode(montador, ids.palco, '2027-03-01T12:00:00Z'), false);
  // Quem é de fora não usa a função para sondar credencial alheia.
  assert.deepEqual(await como(ids.bia, 'select pode_entrar($1, null) as ok', [ids.credCaio]), [{ ok: false }]);
});

test('ponto de leitura: operação cria; o aparelho da equipe avisa que sincronizou', async () => {
  const ponto = (nome: string, zona: string | null, modo = 'entrada_unica') => como<{ id: string }>(ids.opa,
    'insert into ponto_leitura (evento_id, zona_id, nome, modo) values ($1, $2, $3, $4) returning id', [ids.eventoA, zona, nome, modo]);
  ids.portao = um(await ponto('Portão 1', null)).id;
  ids.pontoVip = um(await ponto('Porta VIP', ids.vip, 'passagem_livre')).id;
  await assert.rejects(ponto('Zona alheia', ids.zonaB), /foreign key/);
  await assert.rejects(como(ids.gil, "insert into ponto_leitura (evento_id, nome) values ($1, 'Improvisado')", [ids.eventoA]), /row-level security/);
  assert.ok(um(await como<{ em: Date }>(ids.gil, 'select ponto_leitura_sincronizou($1) as em', [ids.portao])).em instanceof Date);
  await assert.rejects(como(ids.bia, 'select ponto_leitura_sincronizou($1)', [ids.portao]), /não encontrado/);
  assert.deepEqual(await como(ids.eva, 'select 1 from ponto_leitura'), []);
});

test('check-in por credencial: completa o ingresso, recusa evento trocado e segue valendo o primeiro', async () => {
  const ler = (quem: string, campos: Record<string, unknown>) => {
    const linha = { id: randomUUID(), evento_id: ids.eventoA, equipe_id: quem, portao: 'Portão 1', metodo: 'qr', feito_em: '2027-03-01T08:00:00Z', ...campos };
    const nomes = Object.keys(linha);
    return como(quem, `insert into checkin (${nomes.join(', ')}) values (${nomes.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(linha));
  };
  // Formato da v1 (só ingresso) continua aceito e ganha a credencial.
  await ler(ids.gil, { ingresso_id: ids.ingresso });
  await ler(ids.gil, { credencial_id: ids.credCaio, ponto_leitura_id: ids.portao, feito_em: '2027-03-01T08:05:00Z' });
  // Categoria sem ingresso entra pela credencial.
  await ler(ids.gil, { credencial_id: ids.credDuda, ponto_leitura_id: ids.portao, feito_em: '2027-03-01T07:00:00Z' });
  // Zona: passagem liberada, saída e uma leitura barrada.
  await ler(ids.opa, { credencial_id: ids.credCaio, ponto_leitura_id: ids.pontoVip, portao: 'Porta VIP', feito_em: '2027-03-01T07:30:00Z' });
  await ler(ids.opa, { credencial_id: ids.credCaio, ponto_leitura_id: ids.pontoVip, portao: 'Porta VIP', sentido: 'saida', feito_em: '2027-03-01T07:50:00Z' });
  await ler(ids.opa, { credencial_id: ids.credDuda, ponto_leitura_id: ids.pontoVip, portao: 'Porta VIP', resultado: 'negado', feito_em: '2027-03-01T09:00:00Z' });

  const linhas = await dono<{ ingresso_id: string | null; credencial_id: string }>('select ingresso_id, credencial_id from checkin where credencial_id = $1 limit 1', [ids.credCaio]);
  assert.deepEqual(linhas, [{ ingresso_id: ids.ingresso, credencial_id: ids.credCaio }]);
  // A visão da v1: a leitura na zona (07:30) não rouba o lugar da entrada no evento (08:00).
  const primeiro = um(await como<{ feito_em: Date; portao: string }>(ids.gil, 'select feito_em, portao from checkin_primeiro where ingresso_id = $1', [ids.ingresso]));
  assert.equal(primeiro.feito_em.toISOString(), '2027-03-01T08:00:00.000Z');
  assert.equal((await como(ids.gil, 'select 1 from entrada_primeira')).length, 2);
  const lista = await como<{ nome: string; categoria: string; entrada_portao: string | null }>(ids.gil,
    'select nome, categoria, entrada_portao from lista_credenciais($1) where revogada_em is null order by nome, categoria', [ids.eventoA]);
  assert.deepEqual(lista, [
    { nome: 'Caio', categoria: 'congressista', entrada_portao: 'Portão 1' },
    { nome: 'Duda', categoria: 'seguranca', entrada_portao: 'Portão 1' },
    { nome: 'Eva', categoria: 'montagem', entrada_portao: null },
  ]);
  const porPonto = await como<{ portao: string; entradas: number; credenciais: number; saidas: number; negadas: number }>(ids.ana,
    'select portao, entradas, credenciais, saidas, negadas from entradas_por_ponto where ponto_leitura_id is not null order by portao');
  assert.deepEqual(porPonto, [
    { portao: 'Porta VIP', entradas: 1, credenciais: 1, saidas: 1, negadas: 1 },
    { portao: 'Portão 1', entradas: 2, credenciais: 2, saidas: 0, negadas: 0 },
  ]);

  // Negativos: credencial de outro evento, ponto de outro evento, gente sem papel.
  const credB = um(await dono<{ id: string }>("insert into credencial (evento_id, pessoa_id, categoria) values ($1, $2, 'convidado') returning id", [ids.eventoB, ids.eva])).id;
  const pontoB = um(await dono<{ id: string }>("insert into ponto_leitura (evento_id, nome) values ($1, 'Portão B') returning id", [ids.eventoB])).id;
  await assert.rejects(ler(ids.gil, { credencial_id: credB }), /não pertence a este evento/);
  await assert.rejects(ler(ids.gil, { credencial_id: ids.credCaio, ponto_leitura_id: pontoB }), /não pertence a este evento/);
  await assert.rejects(ler(ids.gil, { ingresso_id: ids.ingresso, credencial_id: ids.credDuda }), /não pertence a este evento/);
  await assert.rejects(ler(ids.eva, { credencial_id: ids.credCaio }), /row-level security/);
  await assert.rejects(ler(ids.bia, { credencial_id: ids.credCaio }), /row-level security/);
  await assert.rejects(ler(ids.gil, { credencial_id: ids.credCaio, equipe_id: ids.opa }), /row-level security/);
  await assert.rejects(como(ids.bia, 'select * from lista_credenciais($1)', [ids.eventoA]), /sem papel de credenciamento/);
  // O dono da credencial vê as próprias leituras; a vizinha, nada.
  assert.equal((await como(ids.duda, 'select 1 from checkin')).length, 2);
  assert.deepEqual(await como(ids.bia, 'select 1 from checkin'), []);
  assert.deepEqual(await como(ids.bia, 'select 1 from entradas_por_ponto'), []);
});

test('evento de demonstração não vaza pela programação', async () => {
  await dono('update evento set demonstracao = true where id = $1', [ids.eventoB]);
  assert.deepEqual(await api.transacao({}, (tx) => tx.consultar('select 1 from zona where evento_id = $1', [ids.eventoB])), []);
  assert.equal((await como(ids.bia, 'select 1 from zona where evento_id = $1', [ids.eventoB])).length, 1);
});

test('migração 0011 em banco da v1.0.0: ingressos e check-ins antigos ganham credencial', async () => {
  const antigo = await criarBancoDeTeste({ migrar: false });
  try {
    const todas = lerMigracoes(PASTA_MIGRACOES);
    await migrar(antigo.dono, todas.filter((m) => m.versao < '0010'));
    const q = async <T extends pg.QueryResultRow>(sql: string, v: unknown[] = []) => (await antigo.dono.query<T>(sql, v)).rows;
    const evento = um(await q<{ id: string }>("insert into evento (slug, nome, inicio, fim, local, publicado) values ('legado', 'Legado', '2026-07-01', '2026-07-03', 'Fortaleza', true) returning id")).id;
    const pessoa = async (n: number) => um(await q<{ id: string }>('insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id', [Buffer.from('c'), hash(n), `p${n}`])).id;
    const [ativa, cancelada] = [await pessoa(1), await pessoa(2)];
    const ingressoAtivo = await emitirIngresso(antigo.dono, evento, ativa);
    const ingressoCancelado = await emitirIngresso(antigo.dono, evento, cancelada);
    await q('update ingresso set cancelado_em = now() where id = $1', [ingressoCancelado]);
    await q("insert into checkin (id, ingresso_id, evento_id, portao, metodo, feito_em) values ($1, $2, $3, 'Portão 1', 'qr', '2026-07-01T08:00:00Z')", [randomUUID(), ingressoAtivo, evento]);
    await migrar(antigo.dono, todas);
    const creds = await q<{ categoria: string; revogada: boolean }>('select categoria, revogada_em is not null as revogada from credencial order by revogada_em nulls first');
    assert.deepEqual(creds, [{ categoria: 'congressista', revogada: false }, { categoria: 'congressista', revogada: true }]);
    const checkin = um(await q<{ ok: boolean; sentido: string; resultado: string }>(
      'select c.credencial_id = cr.id as ok, c.sentido, c.resultado from checkin c join credencial cr on cr.ingresso_id = c.ingresso_id'));
    assert.deepEqual(checkin, { ok: true, sentido: 'entrada', resultado: 'liberado' });
    assert.equal((await q('select 1 from checkin_primeiro')).length, 1);
  } finally {
    await antigo.apagar();
  }
});

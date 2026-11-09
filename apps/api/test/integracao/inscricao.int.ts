/** Feature 02 pela API com Postgres real: vagas, idempotência, recusa, RLS, LGPD e expurgo. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { semear } from '../../src/shared/db/semeador.ts';
import { loggerSilencioso } from '../../src/shared/logger.ts';
import { criarApp, dependenciasConta, dependenciasInscricao } from '../../src/main/app.ts';

let b: BancoDeTeste;
let banco: Banco;
let app: Server;
let base: string;
const caixa: { email: string; codigo: string }[] = [];
const recibos: string[] = [];

before(async () => {
  b = await criarBancoDeTeste();
  await semear(b.dono, fileURLToPath(new URL('../../db/sementes', import.meta.url)));
  banco = new Banco({ url: b.url, papel: 'app_api' });
  const chaves = { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) };
  const configBanco = { url: b.url, chaves, email: { provedor: 'dev' as const } };
  const conta = {
    ...dependenciasConta(banco, configBanco, loggerSilencioso),
    email: { enviarCodigo: async (email: string, codigo: string) => { caixa.push({ email, codigo }); } },
  };
  const inscricao = dependenciasInscricao(banco, conta, configBanco, loggerSilencioso);
  app = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: '0.5.0',
    conta,
    inscricao: { ...inscricao, notificador: { recibo: async (_p, r) => void recibos.push(r.evento) } },
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
  const json = { 'content-type': 'application/json' };
  await fetch(`${base}/acesso/codigo`, { method: 'POST', headers: json, body: JSON.stringify({ email }) });
  const codigo = caixa.filter((c) => c.email === email).at(-1)?.codigo;
  const r = await fetch(`${base}/acesso/entrar`, { method: 'POST', headers: json, body: JSON.stringify({ email, codigo }) });
  return ((await r.json()) as { token: string }).token;
}

interface Detalhe { id: string; tipos: { id: string; nome: string; esgotado: boolean }[]; destaques: unknown[] }

async function detalhe(): Promise<Detalhe> {
  return (await (await fetch(`${base}/eventos/cocal-2026`)).json()) as Detalhe;
}
const tipo = async (nome: string) => (await detalhe()).tipos.find((t) => t.nome === nome)?.id ?? '';

function inscrever(token: string, chave: string, corpo: unknown) {
  return fetch(`${base}/eventos/cocal-2026/inscricoes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': chave },
    body: JSON.stringify(corpo),
  });
}

test('evento público: lista com filtro de Libras, tipos com esgotado e destaques da programação', async () => {
  const lista = (await (await fetch(`${base}/eventos?recurso=libras`)).json()) as { eventos: { slug: string; recursosOferecidos: string[] }[] };
  assert.deepEqual(lista.eventos.map((e) => e.slug), ['cocal-2026']);
  await b.dono.query("insert into evento (slug, nome, inicio, fim, local, publicado, recursos_oferecidos) values ('sem-libras', 'Sem Libras', '2026-09-01', '2026-09-02', 'X', true, '{legenda}')");
  const comLibras = (await (await fetch(`${base}/eventos?recurso=libras`)).json()) as { eventos: { slug: string }[] };
  assert.ok(!comLibras.eventos.some((e) => e.slug === 'sem-libras'));
  const d = await detalhe();
  assert.deepEqual(d.tipos.map((t) => [t.nome, t.esgotado]), [['Congressista', false], ['Estudante', false], ['Um dia', true]]);
  assert.equal(d.destaques.length, 4);
});

test('Pix aprovado emite ingresso; repetir a chave não cobra de novo; segundo pedido vira "já inscrito"', async () => {
  const token = await entrar('ana@exemplo.com.br');
  const corpo = { tipoIngressoId: await tipo('Congressista'), metodo: 'pix', recursos: ['libras', 'acompanhante'] };
  const chave = `pix-${randomUUID()}`;
  const a = await inscrever(token, chave, corpo);
  assert.equal(a.status, 201);
  const b2 = await inscrever(token, chave, corpo);
  assert.equal(b2.status, 200);
  assert.equal(((await a.json()) as { ingresso: { id: string } }).ingresso.id, ((await b2.json()) as { ingresso: { id: string } }).ingresso.id);
  const { rows: [pedidos] } = await b.dono.query("select count(*)::int as n from pedido where chave_idempotencia = $1", [chave]);
  assert.equal(pedidos.n, 1);
  assert.equal((await inscrever(token, `pix-${randomUUID()}`, corpo)).status, 409);
  assert.deepEqual(recibos, ['COCAL 2026']);
  const ingressos = (await (await fetch(`${base}/ingressos`, { headers: { authorization: `Bearer ${token}` } })).json()) as { ingressos: { tipo: string; evento: { nome: string } }[] };
  assert.deepEqual(ingressos.ingressos.map((i) => [i.evento.nome, i.tipo]), [['COCAL 2026', 'Congressista']]);
  const { rows: [vagas] } = await b.dono.query("select ocupadas from tipo_ingresso where nome = 'Congressista'");
  assert.equal(vagas.ocupadas, 1);
});

test('cartão recusado: 402, nenhum ingresso, vaga devolvida e só os 4 últimos dígitos guardados', async () => {
  const token = await entrar('bruno@exemplo.com.br');
  const r = await inscrever(token, `cartao-${randomUUID()}`, { tipoIngressoId: await tipo('Estudante'), metodo: 'cartao', cartao: { numero: '4000 0000 0000 0002' } });
  assert.equal(r.status, 402);
  const { rows } = await b.dono.query("select p.status, p.cartao_final, t.ocupadas from pedido p join tipo_ingresso t on t.id = p.tipo_ingresso_id where t.nome = 'Estudante'");
  assert.deepEqual(rows, [{ status: 'recusado', cartao_final: '0002', ocupadas: 0 }]);
  const { rows: texto } = await b.dono.query("select 1 from pedido where row_to_json(pedido)::text like '%4000000000000002%'");
  assert.equal(texto.length, 0);
});

test('esgotado não vende, nem disputando a última vaga ao mesmo tempo', async () => {
  await b.dono.query("update tipo_ingresso set vagas = 1, ocupadas = 0 where nome = 'Um dia'");
  const umDia = await tipo('Um dia');
  const tokens = await Promise.all(['c1@exemplo.com.br', 'c2@exemplo.com.br', 'c3@exemplo.com.br'].map(entrar));
  const status = (await Promise.all(tokens.map((t) => inscrever(t, `corrida-${randomUUID()}`, { tipoIngressoId: umDia, metodo: 'pix' })))).map((r) => r.status);
  assert.deepEqual(status.sort(), [201, 409, 409]);
  assert.equal((await detalhe()).tipos.find((t) => t.nome === 'Um dia')?.esgotado, true);
});

test('RLS: ninguém lê pedido, ingresso ou acessibilidade de outra pessoa nem mexe nas vagas', async () => {
  const outra = await entrar('curiosa@exemplo.com.br');
  const r = await fetch(`${base}/ingressos`, { headers: { authorization: `Bearer ${outra}` } });
  assert.deepEqual(((await r.json()) as { ingressos: unknown[] }).ingressos, []);
  const visto = await banco.transacao({ pessoaId: randomUUID() }, async (tx) => ({
    pedidos: await tx.consultar('select 1 from pedido'),
    ingressos: await tx.consultar('select 1 from ingresso'),
    acessibilidade: await tx.consultar('select 1 from pedido_acessibilidade'),
  }));
  assert.deepEqual(visto, { pedidos: [], ingressos: [], acessibilidade: [] });
  await assert.rejects(banco.transacao({}, (tx) => tx.consultar("update tipo_ingresso set ocupadas = 0")), /permission denied/);
});

test('exportação traz pedidos, ingresso e acessibilidade; excluir a conta guarda o pedido fiscal sem vínculo', async () => {
  const token = await entrar('dora@exemplo.com.br');
  const tipoId = await tipo('Congressista');
  assert.equal((await inscrever(token, `lgpd-${randomUUID()}`, { tipoIngressoId: tipoId, metodo: 'pix', recursos: ['audiodescricao'] })).status, 201);
  const exp = (await (await fetch(`${base}/conta/exportacao`, { headers: { authorization: `Bearer ${token}` } })).json()) as Record<string, unknown[]>;
  assert.equal(exp['pedidos']?.length, 1);
  assert.equal(exp['ingressos']?.length, 1);
  assert.equal(exp['acessibilidade']?.length, 1);
  const { rows: [{ id: pessoaId }] } = await b.dono.query('select pessoa_id as id from pedido order by criado_em desc limit 1');
  assert.equal((await fetch(`${base}/conta`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })).status, 204);
  const { rows } = await b.dono.query(
    `select (select count(*)::int from pedido where pessoa_id is null and status = 'aprovado') as orfaos,
            (select count(*)::int from ingresso where pessoa_id = $1) as ingressos,
            (select count(*)::int from pedido_acessibilidade where pessoa_id = $1) as acess`, [pessoaId]);
  assert.deepEqual(rows[0], { orfaos: 1, ingressos: 0, acess: 0 });
});

test('expurgo apaga pedidos de acessibilidade vencidos e mantém os outros', async () => {
  await b.dono.query("update pedido_acessibilidade set apagar_apos = current_date - 1 where recursos @> '{acompanhante}'");
  const [r] = await banco.transacao({}, (tx) => tx.consultar<{ n: number }>('select expurgar_acessibilidade() as n'));
  assert.equal(r?.n, 1);
});

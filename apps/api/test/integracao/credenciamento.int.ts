/** Feature 04 pela API com Postgres real: QR assinado, pacote da equipe, portões offline e check-in manual. */
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
import { criarApp, dependenciasConta, dependenciasCredenciamento, dependenciasInscricao } from '../../src/main/app.ts';
import { assinadorEd25519, novaChavePrivada, verificadorEd25519 } from '../../src/shared/qr/ed25519.ts';
import { lerToken } from '../../src/shared/qr/token.ts';

let b: BancoDeTeste;
let banco: Banco;
let app: Server;
let base: string;
const caixa: { email: string; codigo: string }[] = [];
let equipe: string;
let caio: string;
let eventoId: string;

before(async () => {
  b = await criarBancoDeTeste();
  await semear(b.dono, fileURLToPath(new URL('../../db/sementes', import.meta.url)));
  banco = new Banco({ url: b.url, papel: 'app_api' });
  const config = { url: b.url, chaves: { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) }, email: { provedor: 'dev' as const } };
  const conta = { ...dependenciasConta(banco, config, loggerSilencioso), email: { enviarCodigo: async (email: string, codigo: string) => void caixa.push({ email, codigo }) } };
  const assinador = assinadorEd25519('qr-teste', novaChavePrivada());
  app = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: '0.6.0',
    conta,
    inscricao: { ...dependenciasInscricao(banco, conta, config, loggerSilencioso, assinador), notificador: { recibo: async () => undefined } },
    credenciamento: dependenciasCredenciamento(banco, conta, assinador),
  });
  await new Promise<void>((ok) => app.listen(0, ok));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;

  equipe = await entrar('equipe@exemplo.com.br', 'Bia da Equipe');
  caio = await entrar('caio@exemplo.com.br', 'Caio Ponte');
  const { rows: [ev] } = await b.dono.query("select id from evento where slug = 'cocal-2026'");
  eventoId = ev.id;
  const { rows: [p] } = await b.dono.query("select pessoa_id from sessao order by criada_em limit 1");
  await b.dono.query("insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'credenciamento')", [eventoId, p.pessoa_id]);
  const { rows: [t] } = await b.dono.query("select id from tipo_ingresso where nome = 'Congressista'");
  const r = await fetch(`${base}/eventos/cocal-2026/inscricoes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${caio}`, 'idempotency-key': `cred-${randomUUID()}` },
    body: JSON.stringify({ tipoIngressoId: t.id, metodo: 'pix', recursos: ['libras'] }),
  });
  assert.equal(r.status, 201);
});

after(async () => {
  await new Promise<void>((ok) => app.close(() => ok()));
  await banco.fechar();
  await b.apagar();
});

async function entrar(email: string, nome: string): Promise<string> {
  const json = { 'content-type': 'application/json' };
  await fetch(`${base}/acesso/codigo`, { method: 'POST', headers: json, body: JSON.stringify({ email }) });
  const codigo = caixa.filter((c) => c.email === email).at(-1)?.codigo;
  const { token } = (await (await fetch(`${base}/acesso/entrar`, { method: 'POST', headers: json, body: JSON.stringify({ email, codigo }) })).json()) as { token: string };
  await fetch(`${base}/conta/primeiro-acesso`, {
    method: 'PUT', headers: { ...json, authorization: `Bearer ${token}` },
    body: JSON.stringify({ nomeCracha: nome, aceitaTermos: true, versaoTermos: '2026-11-03' }),
  });
  return token;
}

const get = async <T>(caminho: string, token: string) => {
  const r = await fetch(`${base}${caminho}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: r.status, corpo: (await r.json()) as T };
};
const sincronizar = (token: string, checkins: unknown[]) =>
  fetch(`${base}/credenciamento/cocal-2026/checkins`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ checkins }),
  });

interface Pacote { chaves: { kid: string; publica: string }[]; participantes: { ingressoId: string; nome: string; recursos: string[]; checkin: unknown }[] }
interface Ingressos { ingressos: { id: string; qr: string; nome: string; checkin: { em: string; portao: string } | null }[] }

test('o QR do participante confere com a chave do pacote da equipe, sem consultar a API', async () => {
  const { corpo: pacote } = await get<Pacote>('/credenciamento/cocal-2026/pacote', equipe);
  const { corpo: { ingressos: [ingresso] } } = await get<Ingressos>('/ingressos', caio);
  assert.ok(ingresso);
  assert.equal(ingresso.nome, 'Caio Ponte');
  const verificador = verificadorEd25519(new Map(pacote.chaves.map((c) => [c.kid, c.publica])));
  // Durante o evento (a semente é de julho de 2026; depois disso o QR vence).
  const leitura = lerToken(ingresso.qr, verificador, eventoId, Date.parse('2026-07-01T12:00:00Z') / 1000);
  assert.equal(leitura.ok && leitura.conteudo.i, ingresso.id);
  const caioNaLista = pacote.participantes.find((p) => p.ingressoId === ingresso.id);
  assert.deepEqual(caioNaLista, { ingressoId: ingresso.id, nome: 'Caio Ponte', tipo: 'Congressista', recursos: ['libras'], checkin: null });
});

test('participante não usa o credenciamento', async () => {
  assert.equal((await get('/credenciamento/cocal-2026/pacote', caio)).status, 403);
  assert.equal((await sincronizar(caio, [{ id: randomUUID(), ingressoId: randomUUID(), portao: 'P', metodo: 'qr', feitoEm: new Date().toISOString() }])).status, 403);
  assert.deepEqual((await get<{ eventos: unknown[] }>('/credenciamento/eventos', caio)).corpo.eventos, []);
  await assert.rejects(banco.transacao({ pessoaId: randomUUID() }, (tx) => tx.consultar('select * from lista_credenciamento($1)', [eventoId])), /sem papel/);
});

test('mesmo ingresso em dois portões offline: vale o primeiro pelo horário, em qualquer ordem, e reenviar não duplica', async () => {
  const { corpo: { ingressos: [ingresso] } } = await get<Ingressos>('/ingressos', caio);
  const id = ingresso?.id ?? '';
  const portao2 = { id: randomUUID(), ingressoId: id, portao: 'Portão 2', metodo: 'qr', feitoEm: '2026-07-01T11:15:00Z' };
  const portao1 = { id: randomUUID(), ingressoId: id, portao: 'Portão 1', metodo: 'qr', feitoEm: '2026-07-01T11:12:00Z' };
  assert.deepEqual(await (await sincronizar(equipe, [portao2])).json(), { resultado: [{ id: portao2.id, situacao: 'valido' }] });
  assert.deepEqual(await (await sincronizar(equipe, [portao1, portao2])).json(), { resultado: [{ id: portao1.id, situacao: 'valido' }, { id: portao2.id, situacao: 'repetido' }] });
  const { rows: [{ n }] } = await b.dono.query('select count(*)::int as n from checkin where ingresso_id = $1', [id]);
  assert.equal(n, 2);
  const { corpo: { ingressos: [depois] } } = await get<Ingressos>('/ingressos', caio);
  assert.deepEqual(depois?.checkin, { em: '2026-07-01T11:12:00.000Z', portao: 'Portão 1' });
  const { corpo: pacote } = await get<Pacote>('/credenciamento/cocal-2026/pacote', equipe);
  assert.deepEqual(pacote.participantes.find((p) => p.ingressoId === id)?.checkin, { em: '2026-07-01T11:12:00.000Z', portao: 'Portão 1' });
});

test('check-in manual registra na auditoria quem da equipe fez', async () => {
  const { corpo: { ingressos: [ingresso] } } = await get<Ingressos>('/ingressos', caio);
  const manual = { id: randomUUID(), ingressoId: ingresso?.id, portao: 'Portão 3', metodo: 'manual', documentoConferido: true, feitoEm: new Date().toISOString() };
  assert.equal((await sincronizar(equipe, [manual])).status, 200);
  const { rows } = await b.dono.query("select a.ator_id, a.dados->>'portao' as portao, s.pessoa_id from auditoria a, sessao s where a.acao = 'checkin.manual' and s.pessoa_id = a.ator_id");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].portao, 'Portão 3');
});

test('RLS: equipe não insere check-in em nome de outro membro nem em evento sem papel', async () => {
  const { rows: [{ pessoa_id: outra }] } = await b.dono.query('select pessoa_id from sessao order by criada_em desc limit 1');
  const { rows: [{ id: ingressoId }] } = await b.dono.query('select id from ingresso limit 1');
  await assert.rejects(banco.transacao({ pessoaId: outra }, (tx) =>
    tx.consultar("insert into checkin (id, ingresso_id, evento_id, equipe_id, portao, metodo, feito_em) values ($1, $2, $3, $4, 'P', 'qr', now())", [randomUUID(), ingressoId, eventoId, outra])), /row-level security/);
});

test('CLI de papel: cria a conta se preciso e é idempotente', async () => {
  const { darPapel } = await import('../../src/main/papel.ts');
  const { CifradorAesGcm } = await import('../../src/shared/cripto/aes-gcm.ts');
  const cifrador = new CifradorAesGcm({ cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) });
  assert.equal(await darPapel(b.dono, cifrador, 'nova@exemplo.com.br', 'credenciamento', 'cocal-2026'), 'criada');
  assert.equal(await darPapel(b.dono, cifrador, 'Nova@Exemplo.com.br', 'admin', 'cocal-2026'), 'existente');
  const { rows } = await b.dono.query("select papel from membro_organizacao m join pessoa p on p.id = m.pessoa_id where p.email_hash = $1", [cifrador.indice('nova@exemplo.com.br', 'pessoa.email')]);
  assert.deepEqual(rows, [{ papel: 'admin' }]);
  await assert.rejects(darPapel(b.dono, cifrador, 'x@exemplo.com.br', 'chefe', 'cocal-2026'), /Papel inválido/);
  await assert.rejects(darPapel(b.dono, cifrador, 'x@exemplo.com.br', 'admin', 'nao-existe'), /não encontrado/);
});

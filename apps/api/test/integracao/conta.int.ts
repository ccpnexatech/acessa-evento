/**
 * Feature 01 de ponta a ponta: HTTP real, Postgres real com o papel app_api,
 * criptografia real. Só o envio de e-mail é capturado.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { loggerSilencioso } from '../../src/shared/logger.ts';
import { criarApp, dependenciasConta } from '../../src/main/app.ts';

let b: BancoDeTeste;
let banco: Banco;
let app: Server;
let base: string;
const caixa: { email: string; codigo: string }[] = [];

before(async () => {
  b = await criarBancoDeTeste();
  banco = new Banco({ url: b.url, papel: 'app_api' });
  const chaves = { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) };
  const conta = {
    ...dependenciasConta(banco, { url: b.url, chaves, email: { provedor: 'dev' } }, loggerSilencioso),
    email: { enviarCodigo: async (email: string, codigo: string) => { caixa.push({ email, codigo }); } },
  };
  app = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: '0.3.0',
    conta,
  });
  await new Promise<void>((ok) => app.listen(0, ok));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((ok) => app.close(() => ok()));
  await banco.fechar();
  await b.apagar();
});

const chamar = async (metodo: string, caminho: string, corpo?: unknown, token?: string) => {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...(corpo ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? (JSON.parse(texto) as Record<string, unknown>) : {}, cabecalhos: r.headers };
};

async function entrar(email: string): Promise<{ token: string; primeiroAcesso: boolean }> {
  assert.equal((await chamar('POST', '/acesso/codigo', { email })).status, 202);
  const codigo = caixa.filter((c) => c.email === email).at(-1)?.codigo;
  const r = await chamar('POST', '/acesso/entrar', { email, codigo });
  assert.equal(r.status, 200);
  return r.corpo as { token: string; primeiroAcesso: boolean };
}

test('jornada completa: código, primeiro acesso, conta, exportação, saída e exclusão', async () => {
  const { token, primeiroAcesso } = await entrar('caio@exemplo.com.br');
  assert.equal(primeiroAcesso, true);

  const semAceite = await chamar('PUT', '/conta/primeiro-acesso', { nomeCracha: 'Caio Ponte', aceitaTermos: false, versaoTermos: '2026-11-03' }, token);
  assert.equal(semAceite.status, 422);
  assert.equal(semAceite.corpo['titulo'], 'Para continuar, aceite os termos.');

  const ok = await chamar('PUT', '/conta/primeiro-acesso', { nomeCracha: 'Caio Ponte', aceitaTermos: true, versaoTermos: '2026-11-03' }, token);
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo['primeiroAcessoPendente'], false);

  const conta = await chamar('GET', '/conta', undefined, token);
  assert.deepEqual([conta.corpo['email'], conta.corpo['nomeCracha']], ['caio@exemplo.com.br', 'Caio Ponte']);

  const exp = await chamar('GET', '/conta/exportacao', undefined, token);
  assert.equal(exp.status, 200);
  assert.match(exp.cabecalhos.get('content-disposition') ?? '', /attachment/);
  assert.equal((exp.corpo['consentimentos'] as unknown[]).length, 1);
  assert.equal((exp.corpo['sessoes'] as unknown[]).length, 1);

  assert.equal((await chamar('POST', '/acesso/sair', undefined, token)).status, 204);
  assert.equal((await chamar('GET', '/conta', undefined, token)).status, 401);

  const segunda = await entrar('caio@exemplo.com.br');
  assert.equal(segunda.primeiroAcesso, false);
  assert.equal((await chamar('DELETE', '/conta', undefined, segunda.token)).status, 204);
  assert.equal((await chamar('GET', '/conta', undefined, segunda.token)).status, 401);

  const { rows } = await b.dono.query<{ pessoas: string; sessoes: string; acoes: string[] }>(
    `select (select count(*) from pessoa) as pessoas, (select count(*) from sessao) as sessoes,
            (select array_agg(acao order by id) from auditoria) as acoes`);
  assert.equal(rows[0]?.pessoas, '0');
  assert.equal(rows[0]?.sessoes, '0');
  assert.deepEqual(rows[0]?.acoes, ['conta.criada', 'conta.termos_aceitos', 'conta.exportada', 'conta.excluida']);
  assert.equal((await b.dono.query('select auditoria_verificar() as v')).rows[0].v, null);

  const termos = await chamar('POST', '/acesso/entrar', { email: 'caio@exemplo.com.br', codigo: '123456' });
  assert.equal(termos.status, 410);
});

test('o banco não guarda e-mail, código nem token em texto puro', async () => {
  const email = 'ana@exemplo.com.br';
  const { token } = await entrar(email);
  const codigo = caixa.at(-1)?.codigo ?? '';
  const { rows } = await b.dono.query<{ dump: string }>(
    `select concat_ws('|', (select string_agg(encode(email_cifrado, 'escape'), ',') from pessoa),
                          (select string_agg(encode(codigo_hash, 'hex'), ',') from codigo_acesso),
                          (select string_agg(encode(token_hash, 'escape'), ',') from sessao)) as dump`);
  const dump = rows[0]?.dump ?? '';
  for (const segredo of [email, token, Buffer.from(codigo).toString('hex')]) assert.ok(!dump.includes(segredo), segredo);
});

test('erros chegam como Problem Details com o código estável', async () => {
  const invalido = await chamar('POST', '/acesso/codigo', { email: 'caio@exemplo' });
  assert.deepEqual([invalido.status, invalido.corpo['codigo']], [422, 'email_invalido']);
  const semCorpo = await chamar('POST', '/acesso/codigo');
  assert.equal(semCorpo.status, 422);
  const semSessao = await chamar('GET', '/conta');
  assert.deepEqual([semSessao.status, semSessao.corpo['codigo']], [401, 'sessao_invalida']);
  const outroEsquema = await fetch(`${base}/conta`, { headers: { authorization: 'Basic abc' } });
  assert.equal(outroEsquema.status, 401);

  const email = 'limite@exemplo.com.br';
  for (let i = 0; i < 3; i++) assert.equal((await chamar('POST', '/acesso/codigo', { email })).status, 202);
  assert.equal((await chamar('POST', '/acesso/codigo', { email })).status, 429);
});

test('5 erros seguidos bloqueiam o código e ficam na auditoria', async () => {
  const email = 'bloqueio@exemplo.com.br';
  await chamar('POST', '/acesso/codigo', { email });
  const certo = caixa.at(-1)?.codigo ?? '';
  const errado = certo === '000000' ? '111111' : '000000';
  const status: number[] = [];
  for (let i = 0; i < 5; i++) status.push((await chamar('POST', '/acesso/entrar', { email, codigo: errado })).status);
  assert.deepEqual(status, [422, 422, 422, 422, 429]);
  assert.equal((await chamar('POST', '/acesso/entrar', { email, codigo: certo })).status, 429);
  const { rows } = await b.dono.query("select count(*)::int as n from auditoria where acao = 'acesso.codigo_bloqueado'");
  assert.equal(rows[0].n, 1);
});

test('a sessão de uma pessoa nunca mostra os dados de outra', async () => {
  const ana = await entrar('ana2@exemplo.com.br');
  const bia = await entrar('bia@exemplo.com.br');
  const contaAna = await chamar('GET', '/conta', undefined, ana.token);
  const contaBia = await chamar('GET', '/conta', undefined, bia.token);
  assert.equal(contaAna.corpo['email'], 'ana2@exemplo.com.br');
  assert.equal(contaBia.corpo['email'], 'bia@exemplo.com.br');
  assert.notEqual(contaAna.corpo['id'], contaBia.corpo['id']);
});

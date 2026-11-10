/** Feature 05 pela API com Postgres real. */
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
import { criarApp, dependenciasAssistente, dependenciasConta } from '../../src/main/app.ts';
import { validarCanais, validarGrafo } from '../../src/modules/assistente/domain/grafo.ts';
import type { Assistente } from '../../src/modules/assistente/domain/grafo.ts';

let b: BancoDeTeste;
let banco: Banco;
let app: Server;
let base: string;
const caixa: { email: string; codigo: string }[] = [];

before(async () => {
  b = await criarBancoDeTeste();
  await semear(b.dono, fileURLToPath(new URL('../../db/sementes', import.meta.url)));
  banco = new Banco({ url: b.url, papel: 'app_api' });
  const config = { url: b.url, chaves: { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) }, email: { provedor: 'dev' as const } };
  const conta = { ...dependenciasConta(banco, config, loggerSilencioso), email: { enviarCodigo: async (email: string, codigo: string) => void caixa.push({ email, codigo }) } };
  app = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: '0.7.0',
    conta,
    assistente: dependenciasAssistente(banco),
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
  return ((await (await fetch(`${base}/acesso/entrar`, { method: 'POST', headers: json, body: JSON.stringify({ email, codigo }) })).json()) as { token: string }).token;
}

test('o assistente de exemplo é publicado nos dois eventos e passa na validação', async () => {
  for (const slug of ['cocal-2026', 'simulacao-2026']) {
    const r = await fetch(`${base}/eventos/${slug}/assistente`);
    assert.equal(r.status, 200);
    const a = (await r.json()) as Assistente;
    assert.equal(a.versao, 1);
    validarGrafo(a.grafo);
    validarCanais(a.canais);
    const inicio = a.grafo.nos[a.grafo.inicio];
    assert.equal(inicio?.tipo === 'pergunta' && inicio.opcoes[0]?.rotulo, 'Acessibilidade');
  }
});

test('ETag por versão: 304 enquanto não muda; a organização publica a versão 2', async () => {
  const atual = (await (await fetch(`${base}/eventos/cocal-2026/assistente`)).json()) as Assistente;
  assert.equal((await fetch(`${base}/eventos/cocal-2026/assistente`, { headers: { 'if-none-match': '"v1"' } })).status, 304);
  const org = await entrar('org@exemplo.com.br');
  const participante = await entrar('participante@exemplo.com.br');
  const { rows: [{ pessoa_id }] } = await b.dono.query('select pessoa_id from sessao order by criada_em limit 1');
  await b.dono.query("insert into membro_organizacao (evento_id, pessoa_id, papel) select id, $1, 'conteudo' from evento where slug = 'cocal-2026'", [pessoa_id]);
  const publicar = (token: string, corpo: unknown) =>
    fetch(`${base}/eventos/cocal-2026/assistente`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) });
  assert.equal((await publicar(participante, { grafo: atual.grafo, canais: atual.canais })).status, 403);
  assert.equal((await publicar(org, { grafo: { inicio: 'x', nos: {} }, canais: atual.canais })).status, 422);
  const r = await publicar(org, { grafo: atual.grafo, canais: atual.canais });
  assert.deepEqual(await r.json(), { versao: 2 });
  assert.equal((await fetch(`${base}/eventos/cocal-2026/assistente`, { headers: { 'if-none-match': '"v1"' } })).status, 200);
  await assert.rejects(banco.transacao({}, (tx) => tx.consultar("update assistente_versao set canais = '[]'")), /permission denied/);
});

test('avaliação anônima: grava só evento, versão, resposta, útil e o dia', async () => {
  const av = (corpo: unknown) => fetch(`${base}/eventos/simulacao-2026/assistente/avaliacoes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  assert.equal((await av({ versao: 1, respostaId: 'r-libras', util: false })).status, 204);
  assert.equal((await av({ versao: 1, respostaId: 'acessibilidade', util: false })).status, 422);
  const { rows } = await b.dono.query("select * from assistente_avaliacao");
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['dia', 'evento_id', 'id', 'resposta_id', 'util', 'versao']);
  const lidas = await banco.transacao({}, (tx) => tx.consultar('select 1 from assistente_avaliacao'));
  assert.deepEqual(lidas, []);
});

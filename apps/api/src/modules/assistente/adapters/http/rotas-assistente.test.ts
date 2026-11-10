import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import { AssistenteServico } from '../../application/casos-de-uso.ts';
import { registrarRotasAssistente } from './rotas-assistente.ts';

let servidor: Server;
let base: string;
const A = {
  versao: 3,
  publicadoEm: '2026-11-01T00:00:00Z',
  canais: [{ tipo: 'email' as const, rotulo: 'E-mail', valor: 'a@b.co' }],
  grafo: { inicio: 'p', nos: { p: { tipo: 'pergunta' as const, texto: 'x', opcoes: [{ rotulo: 'a', destino: 'r' }, { rotulo: 'b', destino: 'r' }] }, r: { tipo: 'resposta' as const, titulo: 'r', texto: 'r', revisadaEm: '2026-11-01' } } },
};

before(async () => {
  const servico = new AssistenteServico({
    eventoId: async (slug) => (slug === 'cocal-2026' ? 'e1' : null),
    podePublicar: async (p) => p === 'org',
    atual: async () => A,
    versao: async () => A,
    publicar: async () => 4,
    avaliar: async () => undefined,
  });
  const r = new Roteador();
  registrarRotasAssistente(r, servico, {
    exigir: async (req) => {
      if (req.cabecalhos['authorization'] === 'Bearer org') return { pessoaId: 'org' };
      throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
    },
    opcional: async () => null,
  });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

test('leitura pública com ETag da versão e 304', async () => {
  const r = await fetch(`${base}/eventos/cocal-2026/assistente`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('etag'), '"v3"');
  assert.equal(((await r.json()) as { versao: number }).versao, 3);
  assert.equal((await fetch(`${base}/eventos/cocal-2026/assistente`, { headers: { 'if-none-match': '"v3"' } })).status, 304);
  assert.equal((await fetch(`${base}/eventos/outro/assistente`)).status, 404);
});

test('publicar exige sessão; avaliar é anônimo e devolve 204', async () => {
  const put = (auth?: string) => fetch(`${base}/eventos/cocal-2026/assistente`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify({ grafo: A.grafo, canais: A.canais }) });
  assert.equal((await put()).status, 401);
  const ok = await put('Bearer org');
  assert.equal(ok.status, 201);
  assert.deepEqual(await ok.json(), { versao: 4 });
  const av = (corpo: unknown) => fetch(`${base}/eventos/cocal-2026/assistente/avaliacoes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  assert.equal((await av({ versao: 3, respostaId: 'r', util: false })).status, 204);
  assert.equal((await av({ versao: 3, respostaId: 'p', util: false })).status, 422);
});

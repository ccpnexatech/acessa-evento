import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import { CredenciamentoServico } from '../../application/casos-de-uso.ts';
import { registrarRotasCredenciamento } from './rotas-credenciamento.ts';

let servidor: Server;
let base: string;
const ID = '01900000-0000-7000-8000-000000000001';
const EVENTO = { id: 'e1', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03' };

before(async () => {
  const servico = new CredenciamentoServico({
    repositorio: {
      evento: async (_p, slug) => (slug === 'cocal-2026' ? EVENTO : null),
      eDaEquipe: async (p) => p === 'equipe',
      eventosDaEquipe: async () => [EVENTO],
      participantes: async () => [],
      registrar: async (_p, _e, lote) => ({ novos: lote.map((c) => c.id), situacao: new Map(lote.map((c) => [c.id, 'valido'] as const)) }),
    },
    auditoria: { registrar: async () => undefined },
    chaves: [],
    agoraMs: () => Date.now(),
  });
  const r = new Roteador();
  registrarRotasCredenciamento(r, servico, {
    exigir: async (req) => {
      const t = req.cabecalhos['authorization'];
      if (t === 'Bearer equipe') return { pessoaId: 'equipe' };
      if (t === 'Bearer participante') return { pessoaId: 'participante' };
      throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
    },
    opcional: async () => null,
  });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

const get = (caminho: string, quem?: string) => fetch(`${base}${caminho}`, { headers: quem ? { authorization: `Bearer ${quem}` } : {} });
const post = (corpo: unknown, quem = 'equipe') =>
  fetch(`${base}/credenciamento/cocal-2026/checkins`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${quem}` }, body: JSON.stringify(corpo) });

test('eventos e pacote só com sessão e sem cache', async () => {
  assert.equal((await get('/credenciamento/eventos')).status, 401);
  const r = await get('/credenciamento/cocal-2026/pacote', 'equipe');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal((await get('/credenciamento/eventos', 'equipe')).status, 200);
});

test('participante recebe 403; evento inexistente 404; lote inválido 422', async () => {
  assert.equal((await get('/credenciamento/cocal-2026/pacote', 'participante')).status, 403);
  assert.equal((await get('/credenciamento/outro-evento/pacote', 'equipe')).status, 404);
  assert.equal((await post({ checkins: [] })).status, 422);
});

test('sincroniza a fila e devolve a situação de cada check-in', async () => {
  const r = await post({ checkins: [{ id: ID, ingressoId: ID, portao: 'Portão 1', metodo: 'qr', feitoEm: new Date().toISOString() }] });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { resultado: [{ id: ID, situacao: 'valido' }] });
  assert.equal((await post({ checkins: [{ id: ID, ingressoId: ID, portao: 'P', metodo: 'qr', feitoEm: new Date().toISOString() }] }, 'participante')).status, 403);
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import { InscricaoServico } from '../../application/casos-de-uso.ts';
import { pagamentoSimulado } from '../pagamento-simulado.ts';
import { registrarRotasInscricao } from './rotas-inscricao.ts';
import type { Ingresso } from '../../domain/inscricao.ts';

const TIPO = '01900000-0000-7000-8000-000000000001';
const ING: Ingresso = { id: 'i1', tipo: 'Congressista', emitidoEm: 'x', evento: { slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'F' } };
let servidor: Server;
let base: string;
let recebido: string | null = null;

before(async () => {
  const evento = {
    id: 'e1', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'F', fuso: 'America/Fortaleza',
    descricao: null, recursosOferecidos: ['libras' as const], inscricoesAbertas: true, destaques: [],
    tipos: [{ id: TIPO, nome: 'Congressista', descricao: null, precoCentavos: 100, esgotado: false }],
  };
  let aprovado = false;
  const servico = new InscricaoServico({
    repositorio: {
      eventos: async (r) => {
        recebido = r;
        return [evento];
      },
      evento: async (slug) => (slug === 'cocal-2026' ? evento : null),
      pedidoPorChave: async (_p, chave) => (aprovado && chave === 'repetida-0000000001' ? { id: 'ped', status: 'aprovado', metodo: 'pix', valorCentavos: 100, tipoIngressoId: TIPO, eventoId: 'e1' } : null),
      temIngresso: async () => false,
      reservar: async (_p, r) => ({ id: 'ped', status: 'pendente', metodo: r.metodo, valorCentavos: 100, tipoIngressoId: TIPO, eventoId: 'e1' }),
      concluir: async (_p, _id, status) => {
        aprovado = status === 'aprovado';
        return aprovado ? ING : null;
      },
      ingressoDoPedido: async () => ING,
      ingressos: async () => [ING],
    },
    pagamento: pagamentoSimulado(),
    auditoria: { registrar: async () => undefined },
    notificador: { recibo: async () => undefined },
  });
  const r = new Roteador();
  registrarRotasInscricao(r, servico, {
    exigir: async (req) => {
      if (req.cabecalhos['authorization'] !== 'Bearer ok') throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
      return { pessoaId: 'p1' };
    },
    opcional: async () => null,
  });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

const inscrever = (chave: string | null, corpo: unknown, auth = 'Bearer ok') =>
  fetch(`${base}/eventos/cocal-2026/inscricoes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth, ...(chave ? { 'idempotency-key': chave } : {}) },
    body: JSON.stringify(corpo),
  });

test('lista pública com filtro e cache curto; detalhe sem cache; 404 para evento inexistente', async () => {
  const l = await fetch(`${base}/eventos?recurso=libras`);
  assert.equal(l.status, 200);
  assert.equal(l.headers.get('cache-control'), 'public, max-age=60');
  assert.equal(recebido, 'libras');
  assert.equal((await fetch(`${base}/eventos?recurso=xyz`)).status, 422);
  const d = await fetch(`${base}/eventos/cocal-2026`);
  assert.equal(d.headers.get('cache-control'), 'no-store');
  assert.equal(((await d.json()) as { tipos: unknown[] }).tipos.length, 1);
  assert.equal((await fetch(`${base}/eventos/nao-existe`)).status, 404);
});

test('inscrição: 201 na primeira, 200 ao repetir a chave; exige sessão e chave', async () => {
  const corpo = { tipoIngressoId: TIPO, metodo: 'pix' };
  assert.equal((await inscrever('repetida-0000000001', corpo, 'Bearer x')).status, 401);
  assert.equal((await inscrever(null, corpo)).status, 400);
  const a = await inscrever('repetida-0000000001', corpo);
  assert.equal(a.status, 201);
  assert.equal(((await a.json()) as { ingresso: Ingresso }).ingresso.id, 'i1');
  assert.equal((await inscrever('repetida-0000000001', corpo)).status, 200);
});

test('cartão recusado vira 402 com mensagem pronta para a tela', async () => {
  const r = await inscrever('recusada-000000001', { tipoIngressoId: TIPO, metodo: 'cartao', cartao: { numero: '4000000000000002' } });
  assert.equal(r.status, 402);
  const p = (await r.json()) as { codigo: string; detalhe?: string; titulo?: string };
  assert.equal(p.codigo, 'pagamento_recusado');
});

test('ingressos da pessoa, só com sessão', async () => {
  assert.equal((await fetch(`${base}/ingressos`)).status, 401);
  const r = await fetch(`${base}/ingressos`, { headers: { authorization: 'Bearer ok' } });
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal(((await r.json()) as { ingressos: unknown[] }).ingressos.length, 1);
});

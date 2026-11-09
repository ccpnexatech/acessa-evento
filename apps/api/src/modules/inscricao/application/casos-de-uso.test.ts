import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InscricaoServico } from './casos-de-uso.ts';
import type { DependenciasInscricao, RepositorioInscricao } from './casos-de-uso.ts';
import { pagamentoSimulado } from '../adapters/pagamento-simulado.ts';
import type { DetalheEvento, IngressoSalvo, Pedido } from '../domain/inscricao.ts';
import { assinadorEd25519, novaChavePrivada } from '../../../shared/qr/ed25519.ts';

const P = '01900000-0000-7000-8000-0000000000aa';
const CONGRESSISTA = '01900000-0000-7000-8000-000000000001';
const UM_DIA = '01900000-0000-7000-8000-000000000003';
const CHAVE = 'chave-de-teste-0001';

function evento(parcial: Partial<DetalheEvento> = {}): DetalheEvento {
  return {
    id: 'e1', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Fortaleza', fuso: 'America/Fortaleza',
    descricao: null, recursosOferecidos: ['libras'], inscricoesAbertas: true, destaques: [],
    tipos: [
      { id: CONGRESSISTA, nome: 'Congressista', descricao: null, precoCentavos: 45000, esgotado: false },
      { id: UM_DIA, nome: 'Um dia', descricao: null, precoCentavos: 12000, esgotado: true },
    ],
    ...parcial,
  };
}

/** Repositório em memória que imita as garantias do banco (vaga, pedido único por chave). */
function memoria(ev = evento()) {
  const pedidos: (Pedido & { chave: string })[] = [];
  const ingressos = new Map<string, IngressoSalvo>();
  const vagas = new Map([[CONGRESSISTA, 1], [UM_DIA, 0]]);
  const acessibilidade: unknown[] = [];
  const repo: RepositorioInscricao = {
    eventos: async () => [ev],
    evento: async (slug) => (slug === ev.slug ? ev : null),
    pedidoPorChave: async (_p, chave) => pedidos.find((p) => p.chave === chave) ?? null,
    temIngresso: async () => ingressos.size > 0,
    async reservar(_p, r) {
      if (!vagas.get(r.tipoIngressoId)) return 'esgotado';
      vagas.set(r.tipoIngressoId, (vagas.get(r.tipoIngressoId) ?? 0) - 1);
      if (r.recursos.length) acessibilidade.push({ recursos: r.recursos, apagar: r.apagarAcessibilidadeApos });
      const p = { id: `ped${pedidos.length + 1}`, status: 'pendente' as const, metodo: r.metodo, valorCentavos: r.valorCentavos, tipoIngressoId: r.tipoIngressoId, eventoId: r.eventoId, chave: r.chave };
      pedidos.push(p);
      return p;
    },
    async concluir(_p, id, status) {
      const i = pedidos.findIndex((p) => p.id === id);
      const p = pedidos[i];
      if (!p) return null;
      pedidos[i] = { ...p, status };
      if (status === 'recusado') {
        vagas.set(p.tipoIngressoId, (vagas.get(p.tipoIngressoId) ?? 0) + 1);
        return null;
      }
      const ing = { id: `ing-${id}`, eventoId: ev.id, tipo: 'Congressista', nome: 'Ana', checkin: null, emitidoEm: 'agora', evento: { slug: ev.slug, nome: ev.nome, inicio: ev.inicio, fim: ev.fim, local: ev.local } };
      ingressos.set(id, ing);
      return ing;
    },
    ingressoDoPedido: async (_p, id) => ingressos.get(id) ?? null,
    ingressos: async () => [...ingressos.values()],
  };
  return { repo, pedidos, ingressos, vagas, acessibilidade };
}

function servico(m = memoria(), extra: Partial<DependenciasInscricao> = {}) {
  const pagamento = pagamentoSimulado();
  const auditoria: string[] = [];
  const recibos: string[] = [];
  const s = new InscricaoServico({
    repositorio: m.repo,
    pagamento,
    auditoria: { registrar: async (e) => void auditoria.push(e.acao) },
    notificador: { recibo: async (_p, r) => void recibos.push(r.evento) },
    assinador: assinadorEd25519('t', novaChavePrivada()),
    ...extra,
  });
  return { s, m, pagamento, auditoria, recibos };
}

const pix = { tipoIngressoId: CONGRESSISTA, metodo: 'pix', recursos: ['libras'] };
const rejeita = (p: Promise<unknown>, codigo: string) => assert.rejects(p, (e: { codigo?: string }) => e.codigo === codigo);

test('Pix aprovado: emite ingresso, audita, manda recibo e guarda o pedido de acessibilidade', async () => {
  const { s, m, auditoria, recibos } = servico();
  const r = await s.inscrever(P, 'cocal-2026', CHAVE, pix);
  assert.equal(r.novo, true);
  assert.equal(r.pedido.status, 'aprovado');
  assert.equal(r.ingresso.evento.nome, 'COCAL 2026');
  assert.match(r.ingresso.qr, /^AE1\.[\w-]+\.[\w-]+$/);
  assert.equal('eventoId' in r.ingresso, false);
  assert.deepEqual(auditoria, ['inscricao.concluida']);
  assert.deepEqual(recibos, ['COCAL 2026']);
  assert.deepEqual(m.acessibilidade, [{ recursos: ['libras'], apagar: '2026-08-02' }]);
});

test('não cobra duas vezes: a mesma chave devolve o mesmo resultado', async () => {
  const { s, pagamento, m } = servico();
  const a = await s.inscrever(P, 'cocal-2026', CHAVE, pix);
  const b = await s.inscrever(P, 'cocal-2026', CHAVE, pix);
  assert.equal(b.novo, false);
  assert.equal(b.ingresso.id, a.ingresso.id);
  assert.equal(pagamento.cobrancas, 1);
  assert.equal(m.pedidos.length, 1);
});

test('rede caiu na cobrança: o pedido fica pendente e a mesma chave conclui sem nova reserva', async () => {
  const real = pagamentoSimulado();
  let falhar = true;
  const { s, m } = servico(memoria(), {
    pagamento: { cobrar: async (c) => (falhar ? Promise.reject(new Error('rede')) : real.cobrar(c)) },
  });
  await assert.rejects(s.inscrever(P, 'cocal-2026', CHAVE, pix), /rede/);
  assert.equal(m.pedidos[0]?.status, 'pendente');
  falhar = false;
  const r = await s.inscrever(P, 'cocal-2026', CHAVE, pix);
  assert.equal(r.pedido.status, 'aprovado');
  assert.equal(m.pedidos.length, 1);
});

test('cartão recusado: nenhum ingresso, vaga devolvida, e a mesma chave continua recusada', async () => {
  const { s, m, auditoria } = servico();
  const corpo = { tipoIngressoId: CONGRESSISTA, metodo: 'cartao', cartao: { numero: '4000000000000002' } };
  await rejeita(s.inscrever(P, 'cocal-2026', CHAVE, corpo), 'pagamento_recusado');
  assert.equal(m.ingressos.size, 0);
  assert.equal(m.vagas.get(CONGRESSISTA), 1);
  assert.deepEqual(auditoria, ['pagamento.recusado']);
  await rejeita(s.inscrever(P, 'cocal-2026', CHAVE, corpo), 'pagamento_recusado');
  const outra = await s.inscrever(P, 'cocal-2026', 'chave-de-teste-0002', { ...corpo, cartao: { numero: '4242424242424242' } });
  assert.equal(outra.pedido.status, 'aprovado');
});

test('esgotado, tipo inexistente, já inscrito, inscrições fechadas e evento inexistente', async () => {
  const { s } = servico();
  await rejeita(s.inscrever(P, 'cocal-2026', CHAVE, { ...pix, tipoIngressoId: UM_DIA }), 'esgotado');
  await rejeita(s.inscrever(P, 'cocal-2026', CHAVE, { ...pix, tipoIngressoId: '01900000-0000-7000-8000-000000000009' }), 'tipo_inexistente');
  await s.inscrever(P, 'cocal-2026', CHAVE, pix);
  await rejeita(s.inscrever(P, 'cocal-2026', 'chave-de-teste-0003', pix), 'ja_inscrito');
  await rejeita(servico(memoria(evento({ inscricoesAbertas: false }))).s.inscrever(P, 'cocal-2026', CHAVE, pix), 'inscricoes_fechadas');
  await rejeita(s.inscrever(P, 'outro-evento', 'chave-de-teste-0004', pix), 'evento_inexistente');
});

test('recibo que falha não desfaz a inscrição', async () => {
  const { s } = servico(memoria(), { notificador: { recibo: async () => Promise.reject(new Error('smtp')) } });
  assert.equal((await s.inscrever(P, 'cocal-2026', CHAVE, pix)).pedido.status, 'aprovado');
});

test('aprovação sem ingresso é erro de integridade', async () => {
  const m = memoria();
  const { s } = servico({ ...m, repo: { ...m.repo, concluir: async () => null } });
  await assert.rejects(s.inscrever(P, 'cocal-2026', CHAVE, pix), /sem ingresso/);
});

test('lista eventos e ingressos', async () => {
  const { s } = servico();
  assert.equal((await s.eventos('libras')).length, 1);
  await s.inscrever(P, 'cocal-2026', CHAVE, pix);
  assert.equal((await s.ingressos(P)).length, 1);
  assert.equal((await s.evento('cocal-2026', null)).nome, 'COCAL 2026');
});

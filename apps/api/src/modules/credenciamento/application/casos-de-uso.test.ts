import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CredenciamentoServico } from './casos-de-uso.ts';
import type { RepositorioCredenciamento } from './casos-de-uso.ts';
import { situacoes } from '../domain/credenciamento.ts';
import type { CheckinEnviado } from '../domain/credenciamento.ts';

const EQUIPE = 'p-equipe';
const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const EVENTO = { id: 'e1', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03' };

function montar() {
  const gravados: CheckinEnviado[] = [];
  const auditoria: { acao: string; dados?: Record<string, unknown> }[] = [];
  const repo: RepositorioCredenciamento = {
    evento: async (_p, slug) => (slug === EVENTO.slug ? EVENTO : null),
    eDaEquipe: async (p) => p === EQUIPE,
    eventosDaEquipe: async (p) => (p === EQUIPE ? [EVENTO] : []),
    participantes: async () => [{ ingressoId: ID(100), nome: 'Caio Ponte', tipo: 'Congressista', recursos: ['libras'], checkin: null }],
    async registrar(_p, _e, lote) {
      const novos = lote.filter((c) => c.ingressoId !== ID(999) && !gravados.some((g) => g.id === c.id));
      gravados.push(...novos);
      return { novos: novos.map((c) => c.id), situacao: situacoes(gravados) };
    },
  };
  const s = new CredenciamentoServico({
    repositorio: repo,
    auditoria: { registrar: async (e) => void auditoria.push(e) },
    chaves: [{ kid: 'k1', publica: 'abc' }],
    agoraMs: () => Date.parse('2026-07-01T12:00:00Z'),
  });
  return { s, gravados, auditoria };
}

const checkin = (n: number, ingresso: number, hora: string, extra: Record<string, unknown> = {}) =>
  ({ id: ID(n), ingressoId: ID(ingresso), portao: 'Portão 1', metodo: 'qr', feitoEm: `2026-07-01T${hora}:00Z`, ...extra });

test('pacote leva evento, chaves públicas e participantes, e fica auditado', async () => {
  const { s, auditoria } = montar();
  const p = await s.pacote(EQUIPE, 'cocal-2026');
  assert.equal(p.evento.nome, 'COCAL 2026');
  assert.deepEqual(p.chaves, [{ kid: 'k1', publica: 'abc' }]);
  assert.equal(p.participantes[0]?.nome, 'Caio Ponte');
  assert.equal(p.geradoEm, '2026-07-01T12:00:00.000Z');
  assert.deepEqual(auditoria.map((a) => a.acao), ['credenciamento.pacote']);
});

test('participante sem papel não baixa pacote nem envia check-in', async () => {
  const { s } = montar();
  await assert.rejects(s.pacote('p-participante', 'cocal-2026'), (e: { codigo?: string }) => e.codigo === 'sem_papel');
  await assert.rejects(s.sincronizar('p-participante', 'cocal-2026', { checkins: [checkin(1, 100, '11:00')] }), (e: { codigo?: string }) => e.codigo === 'sem_papel');
  await assert.rejects(s.pacote(EQUIPE, 'nao-existe'), (e: { codigo?: string }) => e.codigo === 'evento_inexistente');
  assert.deepEqual(await s.eventos('p-participante'), []);
  assert.equal((await s.eventos(EQUIPE)).length, 1);
});

test('mesmo ingresso em dois portões offline: vale o primeiro pelo horário', async () => {
  const { s } = montar();
  const portao2 = await s.sincronizar(EQUIPE, 'cocal-2026', { checkins: [checkin(2, 100, '11:15', { portao: 'Portão 2' })] });
  assert.deepEqual(portao2, [{ id: ID(2), situacao: 'valido' }]);
  const portao1 = await s.sincronizar(EQUIPE, 'cocal-2026', { checkins: [checkin(1, 100, '11:12')] });
  assert.deepEqual(portao1, [{ id: ID(1), situacao: 'valido' }]);
  const reenvio = await s.sincronizar(EQUIPE, 'cocal-2026', { checkins: [checkin(2, 100, '11:15', { portao: 'Portão 2' })] });
  assert.deepEqual(reenvio, [{ id: ID(2), situacao: 'repetido' }]);
});

test('check-in manual fica auditado uma vez; ingresso de outro evento volta ignorado', async () => {
  const { s, auditoria, gravados } = montar();
  const manual = checkin(5, 101, '11:30', { metodo: 'manual', documentoConferido: true });
  await s.sincronizar(EQUIPE, 'cocal-2026', { checkins: [manual, checkin(6, 999, '11:31')] });
  const r = await s.sincronizar(EQUIPE, 'cocal-2026', { checkins: [manual] });
  assert.deepEqual(r, [{ id: ID(5), situacao: 'valido' }]);
  assert.deepEqual(auditoria.map((a) => a.acao), ['checkin.manual']);
  assert.equal(gravados.length, 1);
  const ignorado = await s.sincronizar(EQUIPE, 'cocal-2026', { checkins: [checkin(7, 999, '11:32')] });
  assert.deepEqual(ignorado, [{ id: ID(7), situacao: 'ignorado' }]);
});

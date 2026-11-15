import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AcessosServico } from './acessos.ts';
import type { RepositorioAcessos } from './acessos.ts';
import type { Leitura } from '../domain/acessos.ts';
import { assinadorEd25519, novaChavePrivada, verificadorEd25519 } from '../../../shared/qr/ed25519.ts';
import { lerToken } from '../../../shared/qr/token.ts';

const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const EVENTO = { id: ID(1), slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03' };
const AGORA = Date.parse('2026-07-01T12:00:00Z');
const codigo = (c: string) => (e: { codigo?: string }) => e.codigo === c;
const assinador = assinadorEd25519('k1', novaChavePrivada());
const PAPEIS: Record<string, string[]> = { admin: ['admin'], portao: ['credenciamento'], conteudo: ['conteudo'], fora: [] };

function montar() {
  const auditoria: { acao: string; dados?: Record<string, unknown> }[] = [];
  const gravadas: Leitura[] = [];
  const sincronizados: string[] = [];
  const repositorio: RepositorioAcessos = {
    evento: async (p, slug) => (slug === EVENTO.slug ? { ...EVENTO, papeis: PAPEIS[p] ?? [] } : null),
    regras: async () => [{ zonaId: ID(10), categoria: 'palestrante', de: null, ate: null }],
    definirRegras: async (_p, _e, zona) => zona === ID(10),
    credenciais: async () => [{ id: ID(20), ingressoId: ID(30), nome: 'Caio', categoria: 'congressista', tipo: 'Meia', recursos: ['libras'], revogada: false, entrada: null }],
    garantirPessoa: async () => ID(40),
    emitir: async () => ID(21),
    revogar: async (_p, _e, id) => id === ID(21),
    excecoes: async () => [{ credencialId: ID(20), zonaId: ID(10), efeito: 'permite', motivo: 'Homenageado da noite' }],
    definirExcecao: async () => undefined,
    removerExcecao: async (_p, _e, _c, zona) => zona === ID(10),
    zonas: async () => [{ id: ID(10), nome: 'Sala VIP', aberta: false }],
    pontos: async () => [{ id: ID(50), nome: 'Portão 1', zonaId: null, tipo: 'celular', modo: 'entrada_unica' }],
    meias: async () => [{ id: ID(60), credencialId: ID(20), motivo: 'estudante', resultado: null }, { id: ID(61), credencialId: ID(22), motivo: 'outro', resultado: null }],
    conferirMeia: async (_p, _e, id) => id === ID(60),
    registrar: async (_p, _e, lote) => {
      const novas = lote.filter((l) => l.credencialId !== ID(99) && !gravadas.some((g) => g.id === l.id));
      gravadas.push(...novas);
      return { novas: novas.map((l) => l.id), situacao: new Map(lote.filter((l) => l.credencialId !== ID(99)).map((l) => [l.id, 'registrada'] as const)) };
    },
    marcarSincronizado: async (_p, ponto) => {
      if (ponto === ID(51)) throw new Error('ponto de outro evento');
      sincronizados.push(ponto);
    },
    hoje: async () => [
      { id: ID(50), nome: 'Portão 1', zonaId: null, zona: null, tipo: 'celular', modo: 'entrada_unica', ativo: true, ultimaSincEm: '2026-07-01T11:55:00Z', entradas: 12, credenciais: 12, saidas: 0, negadas: 1, ultimaLeituraEm: '2026-07-01T11:54:00Z' },
      { id: ID(52), nome: 'Portão 2', zonaId: null, zona: null, tipo: 'celular', modo: 'entrada_unica', ativo: true, ultimaSincEm: '2026-07-01T11:00:00Z', entradas: 3, credenciais: 3, saidas: 0, negadas: 0, ultimaLeituraEm: null },
      { id: ID(53), nome: 'Porta VIP', zonaId: ID(10), zona: 'Sala VIP', tipo: 'celular', modo: 'passagem_livre', ativo: true, ultimaSincEm: null, entradas: 0, credenciais: 0, saidas: 0, negadas: 0, ultimaLeituraEm: null },
      { id: ID(54), nome: 'Desligado', zonaId: null, zona: null, tipo: 'totem', modo: 'entrada_unica', ativo: false, ultimaSincEm: null, entradas: 0, credenciais: 0, saidas: 0, negadas: 0, ultimaLeituraEm: null },
    ],
    numeros: async () => ({ inscritos: 40, entradas: 15 }),
    avisos: async (_p, slug) => (slug === EVENTO.slug ? [{ id: ID(70), titulo: 'Bem-vindos', corpo: 'O credenciamento abre às 7h.', urgente: false, publicadoEm: '2026-07-01T10:00:00Z' }] : null),
    minhas: async () => [
      { id: ID(20), ingressoId: ID(30), categoria: 'congressista', revogada: false, evento: { ...EVENTO, local: 'Fortaleza' }, parceiro: null },
      { id: ID(21), ingressoId: null, categoria: 'seguranca', revogada: false, evento: { ...EVENTO, local: 'Fortaleza' }, parceiro: null },
      { id: ID(23), ingressoId: null, categoria: 'expositor', revogada: true, evento: { ...EVENTO, local: 'Fortaleza' }, parceiro: 'Xis Med' },
    ],
  };
  const s = new AcessosServico({
    repositorio, assinador, agoraMs: () => AGORA,
    auditoria: { registrar: async (e) => void auditoria.push(e) },
    protecao: { cifrar: (t) => new TextEncoder().encode(t), indice: (t) => new TextEncoder().encode(`h:${t}`) },
  });
  return { s, auditoria, gravadas, sincronizados };
}

test('regras da zona: qualquer pessoa da equipe lê; trocar fica auditado; zona de fora não existe', async () => {
  const { s, auditoria } = montar();
  assert.equal((await s.regras('conteudo', 'cocal-2026')).regras.length, 1);
  await s.definirRegras('admin', 'cocal-2026', ID(10), { regras: [{ categoria: 'palestrante' }, { categoria: 'convidado' }] });
  assert.deepEqual(auditoria, [{ atorId: 'admin', acao: 'zona.regras', dados: { eventoId: EVENTO.id, zonaId: ID(10), categorias: ['palestrante', 'convidado'] } }]);
  await assert.rejects(s.definirRegras('admin', 'cocal-2026', ID(11), { regras: [] }), codigo('nao_encontrado'));
  await assert.rejects(s.regras('fora', 'cocal-2026'), codigo('nao_encontrado'));
  await assert.rejects(s.regras('admin', 'outro'), codigo('nao_encontrado'));
});

test('credenciais: só a equipe de portão lista; emitir, revogar e exceção ficam na auditoria sem o e-mail', async () => {
  const { s, auditoria } = montar();
  const lista = await s.credenciais('portao', 'cocal-2026');
  assert.deepEqual([lista.credenciais.length, lista.excecoes.length], [1, 1]);
  await assert.rejects(s.credenciais('conteudo', 'cocal-2026'), codigo('sem_permissao'));
  assert.deepEqual(await s.emitir('admin', 'cocal-2026', { email: 'Duda@exemplo.com.br', categoria: 'seguranca' }), { id: ID(21) });
  await s.revogar('admin', 'cocal-2026', ID(21), { motivo: 'Fora da escala' });
  await s.definirExcecao('admin', 'cocal-2026', ID(20), ID(10), { efeito: 'permite', motivo: 'Homenageado da noite' });
  await s.removerExcecao('admin', 'cocal-2026', ID(20), ID(10));
  assert.deepEqual(auditoria.map((a) => a.acao), ['credencial.emitir', 'credencial.revogar', 'credencial.excecao', 'credencial.excecao_remover']);
  assert.ok(!JSON.stringify(auditoria).includes('duda@'));
  await assert.rejects(s.emitir('admin', 'cocal-2026', { email: 'duda', categoria: 'seguranca' }), codigo('dados_invalidos'));
  await assert.rejects(s.revogar('admin', 'cocal-2026', ID(22), { motivo: 'Fora da escala' }), codigo('nao_encontrado'));
  await assert.rejects(s.removerExcecao('admin', 'cocal-2026', ID(20), ID(11)), codigo('nao_encontrado'));
});

test('pacote do leitor: chaves, credenciais, zonas, regras, pontos e meias com o documento a pedir; exceção sem o motivo', async () => {
  const { s, auditoria } = montar();
  const p = await s.pacote('portao', 'cocal-2026');
  assert.deepEqual(p.chaves, [{ kid: 'k1', publica: assinador.chavePublica }]);
  assert.deepEqual(p.excecoes, [{ credencialId: ID(20), zonaId: ID(10), efeito: 'permite' }]);
  assert.deepEqual(p.meias.map((m) => m.documento), ['carteira de estudante', 'documento que comprove a meia-entrada']);
  assert.deepEqual([p.zonas.length, p.regras.length, p.pontos.length, p.geradoEm], [1, 1, 1, '2026-07-01T12:00:00.000Z']);
  assert.deepEqual(auditoria, [{ atorId: 'portao', acao: 'acessos.pacote', dados: { eventoId: EVENTO.id, credenciais: 1 } }]);
  await assert.rejects(s.pacote('conteudo', 'cocal-2026'), codigo('sem_permissao'));
});

test('leituras: registra, ignora o que não é do evento, audita a manual uma vez e marca o ponto como sincronizado', async () => {
  const { s, auditoria, gravadas, sincronizados } = montar();
  const leitura = (n: number, extra: Record<string, unknown> = {}) => ({ id: ID(n), credencialId: ID(20), pontoId: ID(50), metodo: 'qr', feitoEm: '2026-07-01T11:00:00Z', ...extra });
  const manual = leitura(101, { metodo: 'manual', documentoConferido: true });
  const r = await s.sincronizar('portao', 'cocal-2026', { leituras: [leitura(100), manual, leitura(102, { credencialId: ID(99) }), leitura(103, { pontoId: ID(51) })] });
  assert.deepEqual(r.map((x) => x.situacao), ['registrada', 'registrada', 'ignorada', 'registrada']);
  await s.sincronizar('portao', 'cocal-2026', { leituras: [manual] });
  assert.equal(gravadas.length, 3);
  assert.deepEqual(auditoria.map((a) => a.acao), ['leitura.manual']);
  // O ponto que falhou ao marcar não derruba a sincronização dos outros.
  assert.deepEqual(sincronizados, [ID(50), ID(50)]);
  await assert.rejects(s.sincronizar('conteudo', 'cocal-2026', { leituras: [leitura(104)] }), codigo('sem_permissao'));
  await assert.rejects(s.sincronizar('portao', 'cocal-2026', { leituras: [] }), codigo('dados_invalidos'));
});

test('conferir meia-entrada não põe o motivo na auditoria', async () => {
  const { s, auditoria } = montar();
  await s.conferirMeia('portao', 'cocal-2026', ID(60), { resultado: 'confirmada' });
  assert.deepEqual(auditoria, [{ atorId: 'portao', acao: 'meia.conferir', dados: { eventoId: EVENTO.id, resultado: 'confirmada' } }]);
  await assert.rejects(s.conferirMeia('portao', 'cocal-2026', ID(61), { resultado: 'recusada' }), codigo('nao_encontrado'));
});

test('chegou o dia: entradas registradas por ponto e aviso para quem está sem sincronizar', async () => {
  const { s } = montar();
  const h = await s.hoje('conteudo', 'cocal-2026');
  assert.deepEqual(h.numeros, { inscritos: 40, entradas: 15 });
  assert.deepEqual(h.pontos.map((p) => [p.nome, p.minutosSemSincronizar, p.atencao]), [
    ['Portão 1', 5, null],
    ['Portão 2', 60, 'Sem atualizar há 60 min. Peça para abrir o leitor com internet.'],
    ['Porta VIP', null, 'Ainda não sincronizou. Abra o leitor neste ponto com internet.'],
    ['Desligado', null, null],
  ]);
  assert.ok(!JSON.stringify(h).toLowerCase().includes('lotação'));
});

test('avisos do evento para quem pergunta; evento que a pessoa não vê não existe', async () => {
  const { s } = montar();
  assert.equal((await s.avisos('caio', 'cocal-2026')).avisos[0]?.titulo, 'Bem-vindos');
  await assert.rejects(s.avisos('caio', 'outro'), codigo('nao_encontrado'));
});

test('minhas credenciais: QR com ingresso para o congressista, com credencial para os outros, nenhum para a cancelada', async () => {
  const { s } = montar();
  const { credenciais: [congressista, seguranca, cancelada] } = await s.minhas('caio');
  const verificador = verificadorEd25519(new Map([['k1', assinador.chavePublica]]));
  const ler = (qr: string | null | undefined) => lerToken(qr ?? '', verificador, EVENTO.id, AGORA / 1000);
  const a = ler(congressista?.qr);
  const b = ler(seguranca?.qr);
  assert.deepEqual([a.ok && a.conteudo.i, a.ok && a.conteudo.c], [ID(30), undefined]);
  assert.deepEqual([b.ok && b.conteudo.i, b.ok && b.conteudo.c], [undefined, ID(21)]);
  assert.deepEqual([cancelada?.qr, cancelada?.parceiro], [null, 'Xis Med']);
});

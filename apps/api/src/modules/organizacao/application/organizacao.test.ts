import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrganizacaoServico } from './organizacao.ts';
import type { EventoDetalhe, NovoConvite, RepositorioOrganizacao } from './organizacao.ts';

const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ORG = ID(1);
const EVENTO: EventoDetalhe = {
  id: ID(2), slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', publicado: false, demonstracao: false,
  organizacaoId: ORG, papeis: ['admin'], local: 'Fortaleza', localId: null, descricao: null, fuso: 'America/Fortaleza',
  inscricoesAbertas: false, recursosOferecidos: [], tema: {}, feiraM2PorCredencial: 3, organizacao: 'Sociedade A',
};
const codigo = (c: string) => (e: { codigo?: string }) => e.codigo === c;
const utf8 = new TextEncoder();

function montar() {
  const auditoria: { acao: string; dados?: Record<string, unknown> }[] = [];
  const emails: { para: string; assunto: string }[] = [];
  const convites: NovoConvite[] = [];
  const repositorio: RepositorioOrganizacao = {
    organizacoes: async () => [{ id: ORG, nome: 'Sociedade A', papeis: ['dono'] }],
    eventos: async () => [EVENTO],
    convitesPendentes: async () => [{ id: ID(9), organizacao: 'Sociedade B', evento: 'Outro', parceiro: null, papeis: ['conteudo'], expiraEm: '2026-12-01T00:00:00Z' }],
    criarOrganizacao: async () => ORG,
    organizacao: async (_p, id) => (id === ORG ? { id: ORG, nome: 'Sociedade A' } : null),
    criarEvento: async (_p, _o, v) => ({ id: ID(3), slug: String(v['slug']) }),
    evento: async (pessoa, slug) => (slug !== EVENTO.slug ? null : { ...EVENTO, papeis: pessoa === 'fora' ? [] : pessoa === 'portao' ? ['credenciamento'] : ['admin'] }),
    prontidao: async () => [{ item: 'local', feito: false, quantidade: 0 }],
    numeros: async () => ({ inscritos: 12 }),
    alterarEvento: async (pessoa) => pessoa === 'admin',
    equipe: async () => [{ pessoaId: ID(4), nome: 'Gil', papeis: ['credenciamento'], cargo: null, exibirPublico: false }],
    definirMembro: async () => undefined,
    removerMembro: async (_p, _e, alvo) => alvo === ID(4),
    convites: async () => [{ id: ID(8), emailCifrado: utf8.encode('bia@exemplo.com.br'), papeis: ['conteudo'], expiraEm: '2026-12-01T00:00:00Z', situacao: 'aguardando' }],
    criarConvite: async (_p, c) => {
      convites.push(c);
      return { id: ID(7), expiraEm: '2026-12-01T00:00:00Z' };
    },
    revogarConvite: async (_p, id) => id === ID(7),
    aceitarConvite: async (_p, id) => id === ID(7),
  };
  const s = new OrganizacaoServico({
    repositorio,
    auditoria: { registrar: async (e) => void auditoria.push(e) },
    protecao: { cifrar: (t) => utf8.encode(t), decifrar: (c) => new TextDecoder().decode(c), indice: (v) => utf8.encode(`h:${v}`) },
    enviarEmail: async (para, assunto) => {
      if (para.startsWith('falha')) throw new Error('caiu');
      emails.push({ para, assunto });
    },
  });
  return { s, auditoria, emails, convites };
}

test('início junta organizações, eventos e convites pendentes', async () => {
  const { s } = montar();
  const i = await s.inicio('admin');
  assert.deepEqual([i.organizacoes.length, i.eventos.length, i.convites.length], [1, 1, 1]);
  assert.equal((await s.convites('admin')).length, 1);
});

test('criar organização e evento ficam na auditoria', async () => {
  const { s, auditoria } = montar();
  assert.deepEqual(await s.criarOrganizacao('admin', { nome: 'Sociedade A' }), { id: ORG });
  const evento = await s.criarEvento('admin', ORG, { nome: 'Jornada 2027', slug: 'jornada-2027', inicio: '2027-03-01', fim: '2027-03-02', local: 'Fortaleza', demonstracao: true });
  assert.equal(evento.slug, 'jornada-2027');
  assert.deepEqual(auditoria.map((a) => a.acao), ['organizacao.criar', 'evento.criar']);
  assert.equal(auditoria[1]?.dados?.['demonstracao'], true);
  await assert.rejects(s.criarEvento('admin', 'abc', {}), codigo('dados_invalidos'));
  await assert.rejects(s.criarEvento('admin', 'abc', { nome: 'Jornada', slug: 'jornada', inicio: '2027-03-01', fim: '2027-03-02', local: 'X' }), codigo('nao_encontrado'));
});

test('início do evento traz papéis, checklist e números; quem é de fora não entra', async () => {
  const { s } = montar();
  const r = await s.evento('admin', 'cocal-2026');
  assert.deepEqual([r.evento.papeis, r.prontidao[0]?.item, r.numeros['inscritos']], [['admin'], 'local', 12]);
  await assert.rejects(s.evento('admin', 'nao-existe'), codigo('nao_encontrado'));
  await assert.rejects(s.evento('fora', 'cocal-2026'), codigo('sem_permissao'));
});

test('alterar evento: publicar e despublicar têm ação própria; sem papel de admin é recusado', async () => {
  const { s, auditoria } = montar();
  await s.alterarEvento('admin', 'cocal-2026', { publicado: true });
  await s.alterarEvento('admin', 'cocal-2026', { publicado: false });
  await s.alterarEvento('admin', 'cocal-2026', { nome: 'COCAL', tema: { corPrimaria: 'azul', corDestaque: 'verde', fonte: 'padrao', arredondamento: 'reto' } });
  assert.deepEqual(auditoria.map((a) => a.acao), ['evento.publicar', 'evento.despublicar', 'evento.alterar']);
  assert.deepEqual(auditoria[2]?.dados?.['campos'], ['nome', 'tema']);
  await assert.rejects(s.alterarEvento('portao', 'cocal-2026', { publicado: true }), codigo('sem_permissao'));
});

test('equipe: lista com convites decifrados e a frase de cada papel; definir e remover auditados', async () => {
  const { s, auditoria } = montar();
  const e = await s.equipe('admin', 'cocal-2026');
  assert.equal(e.membros[0]?.nome, 'Gil');
  assert.equal(e.convites[0]?.email, 'bia@exemplo.com.br');
  assert.equal(e.papeis.length, 8);
  await s.definirMembro('admin', 'cocal-2026', ID(4), { papeis: ['conteudo', 'operacao'] });
  await s.removerMembro('admin', 'cocal-2026', ID(4));
  assert.deepEqual(auditoria.map((a) => a.acao), ['equipe.definir', 'equipe.remover']);
  await assert.rejects(s.removerMembro('admin', 'cocal-2026', ID(5)), codigo('nao_encontrado'));
  await assert.rejects(s.definirMembro('admin', 'cocal-2026', 'x', { papeis: ['conteudo'] }), codigo('nao_encontrado'));
});

test('convite de evento: cifra o e-mail, envia e não põe o e-mail na auditoria', async () => {
  const { s, auditoria, emails, convites } = montar();
  const c = await s.convidarParaEvento('admin', 'cocal-2026', { email: 'Bia@exemplo.com.br', papeis: ['credenciamento'] });
  assert.equal(c.id, ID(7));
  assert.deepEqual([convites[0]?.organizacaoId, convites[0]?.eventoId, convites[0]?.papeis], [ORG, EVENTO.id, ['credenciamento']]);
  assert.deepEqual(emails, [{ para: 'bia@exemplo.com.br', assunto: 'Convite para a equipe: COCAL 2026' }]);
  assert.ok(!JSON.stringify(auditoria).includes('bia@'));
  // Falha no envio não desfaz o convite: ele aparece no app de quem foi convidado.
  assert.equal((await s.convidarParaEvento('admin', 'cocal-2026', { email: 'falha@exemplo.com.br', papeis: ['conteudo'] })).id, ID(7));
});

test('convite de organização só aceita dono e admin', async () => {
  const { s, convites, emails } = montar();
  await s.convidarParaOrganizacao('admin', ORG, { email: 'caio@exemplo.com.br', papeis: ['admin'] });
  assert.equal(convites[0]?.eventoId, null);
  assert.equal(emails[0]?.assunto, 'Convite para a equipe: Sociedade A');
  await assert.rejects(s.convidarParaOrganizacao('admin', ORG, { email: 'caio@exemplo.com.br', papeis: ['conteudo'] }), codigo('dados_invalidos'));
  await assert.rejects(s.convidarParaOrganizacao('admin', ID(99), { email: 'caio@exemplo.com.br', papeis: ['admin'] }), codigo('nao_encontrado'));
});

test('revogar e aceitar convite: o que não vale mais tem resposta clara', async () => {
  const { s, auditoria } = montar();
  await s.revogarConvite('admin', ID(7));
  await s.aceitarConvite('bia', ID(7));
  assert.deepEqual(auditoria.map((a) => a.acao), ['convite.revogar', 'convite.aceitar']);
  await assert.rejects(s.revogarConvite('admin', ID(6)), codigo('nao_encontrado'));
  await assert.rejects(s.aceitarConvite('bia', ID(6)), (e: { codigo?: string; message: string }) => e.codigo === 'regra' && /não vale mais/.test(e.message));
  await assert.rejects(s.aceitarConvite('bia', 'x'), codigo('nao_encontrado'));
});

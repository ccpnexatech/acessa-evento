import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CadastrosServico } from './cadastros.ts';
import type { Registro, RepositorioCadastros } from './cadastros.ts';
import { CADASTROS, NOMES_CADASTRO } from '../domain/catalogo.ts';
import { validarCampos } from '../domain/campos.ts';

const ORG = '01900000-0000-7000-8000-000000000001';
const ID = '01900000-0000-7000-8000-000000000002';
const codigo = (c: string) => (e: { codigo?: string }) => e.codigo === c;

function montar() {
  const linhas = new Map<string, Registro>();
  const auditoria: { acao: string; dados?: Record<string, unknown> }[] = [];
  const repositorio: RepositorioCadastros = {
    escopo: async (_p, tipo, ref) => (tipo === 'evento' ? (ref === 'cocal-2026' ? 'evento-1' : null) : (ref === ORG ? ORG : null)),
    listar: async () => [...linhas.values()],
    criar: async (_p, _n, _e, valores) => {
      const r = { id: ID, ...valores };
      linhas.set(ID, r);
      return r;
    },
    alterar: async (pessoa, _n, _e, id, valores) => {
      const atual = linhas.get(id);
      if (!atual || pessoa !== 'admin') return null;
      const r = { ...atual, ...valores };
      linhas.set(id, r);
      return r;
    },
    apagar: async (pessoa, _n, _e, id) => pessoa === 'admin' && linhas.delete(id),
  };
  return { s: new CadastrosServico({ repositorio, auditoria: { registrar: async (e) => void auditoria.push(e) } }), auditoria };
}

test('cria, lista, altera e apaga, auditando o que mudou sem guardar o conteúdo', async () => {
  const { s, auditoria } = montar();
  const zona = await s.criar('admin', 'zonas', 'cocal-2026', { nome: 'Sala VIP' });
  assert.deepEqual(zona, { id: ID, nome: 'Sala VIP' });
  assert.equal((await s.listar('admin', 'zonas', 'cocal-2026')).length, 1);
  assert.equal((await s.alterar('admin', 'zonas', 'cocal-2026', ID, { aberta: true }))['aberta'], true);
  await s.apagar('admin', 'zonas', 'cocal-2026', ID);
  assert.deepEqual(auditoria, [
    { atorId: 'admin', acao: 'cadastro.zonas.criar', dados: { eventoId: 'evento-1', id: ID } },
    { atorId: 'admin', acao: 'cadastro.zonas.alterar', dados: { eventoId: 'evento-1', id: ID, campos: ['aberta'] } },
    { atorId: 'admin', acao: 'cadastro.zonas.apagar', dados: { eventoId: 'evento-1', id: ID } },
  ]);
});

test('cadastro da organização usa o id dela e o nome da ação sem hífen', async () => {
  const { s, auditoria } = montar();
  await s.criar('admin', 'modelos-contrato', ORG, { nome: 'Padrão', corpo: 'Contrato de cessão de espaço na feira.' });
  assert.deepEqual(auditoria[0], { atorId: 'admin', acao: 'cadastro.modelos_contrato.criar', dados: { organizacaoId: ORG, id: ID } });
  await assert.rejects(s.listar('admin', 'locais', 'nao-e-uuid'), codigo('nao_encontrado'));
  await assert.rejects(s.listar('admin', 'locais', ID), codigo('nao_encontrado'));
});

test('evento que a pessoa não vê, registro inexistente e falta de permissão viram não encontrado', async () => {
  const { s } = montar();
  await assert.rejects(s.listar('admin', 'zonas', 'outro-evento'), codigo('nao_encontrado'));
  await s.criar('admin', 'zonas', 'cocal-2026', { nome: 'Sala VIP' });
  await assert.rejects(s.alterar('participante', 'zonas', 'cocal-2026', ID, { aberta: true }), codigo('nao_encontrado'));
  await assert.rejects(s.apagar('participante', 'zonas', 'cocal-2026', ID), codigo('nao_encontrado'));
  await assert.rejects(s.alterar('admin', 'zonas', 'cocal-2026', 'x', { aberta: true }), codigo('nao_encontrado'));
  await assert.rejects(s.apagar('admin', 'zonas', 'cocal-2026', 'x'), codigo('nao_encontrado'));
});

test('dados inválidos param antes do banco; operação que o cadastro não oferece é recusada', async () => {
  const { s, auditoria } = montar();
  await assert.rejects(s.criar('admin', 'zonas', 'cocal-2026', {}), codigo('dados_invalidos'));
  await assert.rejects(s.alterar('admin', 'zonas', 'cocal-2026', ID, {}), codigo('dados_invalidos'));
  await assert.rejects(s.alterar('admin', 'parceiros-evento', 'cocal-2026', ID, { categoria: 'expositor' }), codigo('regra'));
  assert.deepEqual(auditoria, []);
});

test('catálogo: todo cadastro tem ao menos um campo obrigatório e rótulos para as mensagens', () => {
  for (const nome of NOMES_CADASTRO) {
    const campos = Object.values(CADASTROS[nome].campos);
    assert.ok(campos.some((c) => 'obrigatorio' in c && c.obrigatorio), `${nome} sem campo obrigatório`);
    assert.ok(campos.every((c) => c.rotulo.length > 1), `${nome} com campo sem rótulo`);
    assert.throws(() => validarCampos(CADASTROS[nome].campos, {}, 'criar'), /preencha este campo/);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgramacaoServico } from './casos-de-uso.ts';
import type { RepositorioProgramacao } from './casos-de-uso.ts';
import { ErroProgramacao } from '../domain/programacao.ts';
import type { Atividade, Evento } from '../domain/programacao.ts';

const ID = '01900000-0000-7000-8000-000000000001';
const evento: Evento = { id: 'e1', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Fortaleza', fuso: 'America/Fortaleza' };
const atividade: Atividade = { id: ID, titulo: 'Abertura', resumo: null, inicio: '2026-07-01T12:00:00Z', fim: '2026-07-01T13:00:00Z', recursos: ['libras'], sala: null, palestrantes: [] };

function repo(): RepositorioProgramacao & { favs: Set<string> } {
  const favs = new Set<string>();
  return {
    favs,
    eventoPorSlug: async (slug) => (slug === 'cocal-2026' ? evento : null),
    versaoAgenda: async () => 'a'.repeat(32),
    agenda: async () => [atividade],
    favoritos: async () => [...favs],
    favoritar: async (_p, id) => {
      if (id !== ID) return false;
      favs.add(id);
      return true;
    },
    desfavoritar: async (_p, id) => {
      favs.delete(id);
    },
  };
}

const erro = (codigo: string) => (e: unknown) => e instanceof ErroProgramacao && e.codigo === codigo;

test('devolve a agenda com versão e evita reenviar quando nada mudou', async () => {
  const s = new ProgramacaoServico(repo());
  const r = await s.agenda('cocal-2026', null, null);
  assert.equal(r.modificada, true);
  assert.ok(r.modificada && r.atividades.length === 1 && r.evento.nome === 'COCAL 2026');
  assert.deepEqual(await s.agenda('cocal-2026', null, 'a'.repeat(32)), { modificada: false, versao: 'a'.repeat(32) });
});

test('evento inexistente ou slug inválido dão evento_inexistente', async () => {
  const s = new ProgramacaoServico(repo());
  await assert.rejects(s.agenda('outro-evento', null, null), erro('evento_inexistente'));
  await assert.rejects(s.agenda('../x', null, null), erro('evento_inexistente'));
  await assert.rejects(s.favoritos('nada-aqui', 'p1'), erro('evento_inexistente'));
});

test('favoritar e desfavoritar são idempotentes', async () => {
  const r = repo();
  const s = new ProgramacaoServico(r);
  await s.favoritar('p1', ID);
  await s.favoritar('p1', ID.toUpperCase());
  assert.deepEqual(await s.favoritos('cocal-2026', 'p1'), [ID]);
  await s.desfavoritar('p1', ID);
  await s.desfavoritar('p1', ID);
  assert.deepEqual(await s.favoritos('cocal-2026', 'p1'), []);
});

test('favoritar atividade que não existe ou id inválido dá atividade_inexistente', async () => {
  const s = new ProgramacaoServico(repo());
  await assert.rejects(s.favoritar('p1', '01900000-0000-7000-8000-00000000ffff'), erro('atividade_inexistente'));
  await assert.rejects(s.favoritar('p1', 'nao-e-uuid'), erro('atividade_inexistente'));
  await assert.rejects(s.desfavoritar('p1', 'nao-e-uuid'), erro('atividade_inexistente'));
});

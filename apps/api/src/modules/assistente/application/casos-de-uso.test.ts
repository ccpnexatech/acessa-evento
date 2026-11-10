import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssistenteServico } from './casos-de-uso.ts';
import type { RepositorioAssistente } from './casos-de-uso.ts';
import type { Assistente } from '../domain/grafo.ts';

const grafo = {
  inicio: 'inicio',
  nos: {
    inicio: { tipo: 'pergunta' as const, texto: 'Sobre?', opcoes: [{ rotulo: 'A', destino: 'r-a' }, { rotulo: 'B', destino: 'r-b' }] },
    'r-a': { tipo: 'resposta' as const, titulo: 'A', texto: 'a', revisadaEm: '2026-11-01' },
    'r-b': { tipo: 'resposta' as const, titulo: 'B', texto: 'b', revisadaEm: '2026-11-01' },
  },
};
const canais = [{ tipo: 'email' as const, rotulo: 'E-mail', valor: 'a@b.co' }];

function montar() {
  const versoes: Assistente[] = [];
  const avaliacoes: unknown[] = [];
  const repo: RepositorioAssistente = {
    eventoId: async (slug) => (slug === 'cocal-2026' ? 'e1' : null),
    podePublicar: async (p) => p === 'org',
    atual: async () => versoes.at(-1) ?? null,
    versao: async (_e, v) => versoes.find((x) => x.versao === v) ?? null,
    publicar: async (_p, _e, a) => {
      versoes.push({ ...a, versao: versoes.length + 1, publicadoEm: 'agora' });
      return versoes.length;
    },
    avaliar: async (...args) => void avaliacoes.push(args),
  };
  return { s: new AssistenteServico(repo), avaliacoes };
}
const codigo = (c: string) => (e: { codigo?: string }) => e.codigo === c;

test('sem versão publicada: 404 próprio; evento inexistente ou slug inválido também', async () => {
  const { s } = montar();
  await assert.rejects(s.atual('cocal-2026', null), codigo('sem_assistente'));
  await assert.rejects(s.atual('outro', null), codigo('evento_inexistente'));
  await assert.rejects(s.atual('../x', null), codigo('evento_inexistente'));
});

test('organização publica versões que crescem; participante não publica; grafo inválido vira 422', async () => {
  const { s } = montar();
  assert.equal(await s.publicar('org', 'cocal-2026', { grafo, canais }), 1);
  assert.equal(await s.publicar('org', 'cocal-2026', { grafo, canais }), 2);
  assert.equal((await s.atual('cocal-2026', null)).versao, 2);
  await assert.rejects(s.publicar('participante', 'cocal-2026', { grafo, canais }), codigo('sem_papel'));
  await assert.rejects(s.publicar('org', 'cocal-2026', { grafo: { inicio: 'x', nos: {} }, canais }), codigo('dados_invalidos'));
  await assert.rejects(s.publicar('org', 'cocal-2026', null), codigo('dados_invalidos'));
});

test('avaliação: só de resposta que existe na versão; nada de pessoa', async () => {
  const { s, avaliacoes } = montar();
  await s.publicar('org', 'cocal-2026', { grafo, canais });
  await s.avaliar('cocal-2026', { versao: 1, respostaId: 'r-a', util: false });
  assert.deepEqual(avaliacoes, [['e1', 1, 'r-a', false]]);
  await assert.rejects(s.avaliar('cocal-2026', { versao: 1, respostaId: 'inicio', util: true }), codigo('dados_invalidos'));
  await assert.rejects(s.avaliar('cocal-2026', { versao: 9, respostaId: 'r-a', util: true }), codigo('dados_invalidos'));
  await assert.rejects(s.avaliar('cocal-2026', { versao: '1', respostaId: 'r-a', util: true }), codigo('dados_invalidos'));
  await assert.rejects(s.avaliar('cocal-2026', null), codigo('dados_invalidos'));
});

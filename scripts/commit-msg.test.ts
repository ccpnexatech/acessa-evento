import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMensagem } from './commit-msg.ts';

test('aceita cabeçalhos no padrão Conventional Commits', () => {
  for (const msg of ['feat(api): expõe a rota /saude', 'fix: corrige fuso', 'ci!: troca o runner', 'docs(adr): registra 0013']) {
    assert.equal(validarMensagem(msg), null, msg);
  }
});

test('recusa cabeçalhos fora do padrão', () => {
  for (const msg of ['ajustes', 'Feat: maiúscula', 'feat(API): escopo maiúsculo', 'feat:sem espaço', `feat: ${'x'.repeat(101)}`]) {
    assert.notEqual(validarMensagem(msg), null, msg);
  }
});

test('ignora a linha de merge gerada pelo git', () => {
  assert.equal(validarMensagem("Merge branch 'x'"), null);
});

/**
 * Garante o ADR 0011 em código: todo par de texto e fundo do design system
 * passa WCAG AA nos 3 temas. Uma mudança de cor que quebre isso não sobe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contraste, cores, temas } from './index.ts';
import type { NomeCor } from './index.ts';

test('contraste segue a fórmula da WCAG', () => {
  assert.equal(contraste('#000000', '#ffffff'), 21);
  assert.equal(contraste('#ffffff', '#ffffff'), 1);
  assert.throws(() => contraste('preto', '#fff'), /Cor inválida/);
});

const TEXTO_EM_FUNDO: ReadonlyArray<readonly [NomeCor, NomeCor]> = [
  ['ink900', 'surface000'], ['ink900', 'surface100'], ['ink900', 'surface200'],
  ['ink600', 'surface000'], ['ink600', 'surface100'], ['ink600', 'surface200'],
  ['onPrimary', 'primary600'], ['onPrimary', 'primary700'], ['primary700', 'primary100'],
  ['onAccent', 'accent400'],
  ['success700', 'success100'], ['warning700', 'warning100'], ['danger700', 'danger100'],
];

for (const tema of temas) {
  for (const [texto, fundo] of TEXTO_EM_FUNDO) {
    test(`${tema}: ${texto} sobre ${fundo} passa 4.5:1`, () => {
      const razao = contraste(cores[tema][texto], cores[tema][fundo]);
      assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
    });
  }
  test(`${tema}: borda de controle passa 3:1 no fundo`, () => {
    assert.ok(contraste(cores[tema].borderControl, cores[tema].surface000) >= 3);
  });
}

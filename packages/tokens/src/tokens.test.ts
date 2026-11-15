/**
 * Garante o ADR 0011 em código: todo par de texto e fundo do design system
 * passa WCAG AA nos 3 temas. Uma mudança de cor que quebre isso não sobe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contraste, corDaPaleta, cores, nomesDaPaleta, paleta, temas } from './index.ts';
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

// Paleta da aparência do evento: toda cor que o organizador pode escolher passa nos 3 temas.
for (const tema of temas) {
  for (const nome of nomesDaPaleta) {
    test(`${tema}: paleta ${nome} tem texto legível e se destaca do fundo da tela`, () => {
      const { fundo, texto } = paleta[tema][nome];
      const noTexto = contraste(texto, fundo);
      // Alto contraste pede 7:1 (AAA); os outros temas, 4.5:1 (AA).
      assert.ok(noTexto >= (tema === 'alto-contraste' ? 7 : 4.5), `texto ${noTexto.toFixed(2)}:1`);
      // 3:1 contra a tela: a faixa ou o botão continuam visíveis sem depender do texto.
      const naTela = contraste(fundo, cores[tema].surface000);
      assert.ok(naTela >= 3, `tela ${naTela.toFixed(2)}:1`);
    });
  }
}

test('paleta: nome desconhecido cai no padrão do app', () => {
  assert.equal(corDaPaleta('light', 'azul').fundo, '#1d4ed8');
  assert.deepEqual(corDaPaleta('light', '#ff0000'), paleta.light.petroleo);
  assert.deepEqual(corDaPaleta('dark', undefined, 'grafite'), paleta.dark.grafite);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroInscricao, dataExpurgo, filtroRecurso, luhnValido, validarChave, validarInscricao, validarSlug } from './inscricao.ts';

const TIPO = '01900000-0000-7000-8000-000000000001';
const codigo = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof ErroInscricao);
    return e.codigo;
  }
  return 'sem erro';
};

test('Luhn aceita cartões de teste e pega dígito trocado', () => {
  assert.equal(luhnValido('4242424242424242'), true);
  assert.equal(luhnValido('4000000000000002'), true);
  assert.equal(luhnValido('4242424242424241'), false);
});

test('inscrição por Pix: recursos repetidos viram um só', () => {
  assert.deepEqual(validarInscricao({ tipoIngressoId: TIPO, recursos: ['libras', 'libras'], metodo: 'pix' }),
    { tipoIngressoId: TIPO, recursos: ['libras'], metodo: 'pix', cartao: null });
});

test('inscrição por cartão limpa espaços e exige número válido', () => {
  assert.deepEqual(validarInscricao({ tipoIngressoId: TIPO, metodo: 'cartao', cartao: { numero: '4242 4242 4242 4242' } }).cartao, { numero: '4242424242424242' });
  assert.equal(codigo(() => validarInscricao({ tipoIngressoId: TIPO, metodo: 'cartao', cartao: { numero: '4242 4242 4242 4241' } })), 'dados_invalidos');
  assert.equal(codigo(() => validarInscricao({ tipoIngressoId: TIPO, metodo: 'cartao' })), 'dados_invalidos');
});

test('rejeita corpo, tipo, recurso e método inválidos', () => {
  for (const corpo of [null, [], { tipoIngressoId: 'x', metodo: 'pix' }, { tipoIngressoId: TIPO, metodo: 'boleto' },
    { tipoIngressoId: TIPO, metodo: 'pix', recursos: ['telepatia'] }, { tipoIngressoId: TIPO, metodo: 'pix', recursos: 'libras' }]) {
    assert.equal(codigo(() => validarInscricao(corpo)), 'dados_invalidos');
  }
});

test('chave de idempotência, slug e filtro', () => {
  assert.equal(validarChave('abcdefgh-12345678'), 'abcdefgh-12345678');
  for (const c of [undefined, 'curta', 'tem espaço no meio aqui']) assert.equal(codigo(() => validarChave(c)), 'chave_invalida');
  assert.equal(codigo(() => validarSlug('../x')), 'evento_inexistente');
  assert.equal(filtroRecurso(null), null);
  assert.equal(filtroRecurso(''), null);
  assert.equal(filtroRecurso('libras'), 'libras');
  assert.equal(codigo(() => filtroRecurso('xyz')), 'dados_invalidos');
});

test('acessibilidade é apagada 30 dias após o fim do evento', () => {
  assert.equal(dataExpurgo('2026-07-03'), '2026-08-02');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cnpjValido, validarCampos } from './campos.ts';
import type { Campos } from './campos.ts';

const CAMPOS: Campos = {
  nome: { tipo: 'texto', rotulo: 'Nome', min: 2, max: 10, obrigatorio: true },
  uf: { tipo: 'texto', rotulo: 'UF', max: 2, padrao: /^[A-Z]{2}$/, maiusculas: true },
  vagas: { tipo: 'inteiro', rotulo: 'Vagas', min: 0, max: 100 },
  largura: { tipo: 'numero', rotulo: 'Largura', min: 0.5 },
  aberta: { tipo: 'booleano', rotulo: 'Aberta' },
  zonaId: { tipo: 'uuid', rotulo: 'Zona' },
  inicio: { tipo: 'instante', rotulo: 'Início' },
  prazo: { tipo: 'data', rotulo: 'Prazo' },
  site: { tipo: 'url', rotulo: 'Site' },
  cnpj: { tipo: 'cnpj', rotulo: 'CNPJ' },
  modo: { tipo: 'opcao', rotulo: 'Modo', opcoes: ['a', 'b'] },
  recursos: { tipo: 'opcoes', rotulo: 'Recursos', opcoes: ['libras', 'legenda'] },
  destaques: { tipo: 'textos', rotulo: 'Destaques', max: 5, maxItens: 2 },
};
const ID = '01900000-0000-7000-8000-0000000000AB';
const recusa = (corpo: unknown, mensagem: RegExp, modo: 'criar' | 'alterar' = 'alterar') =>
  assert.throws(() => validarCampos(CAMPOS, corpo, modo), (e: { codigo?: string; message: string }) => e.codigo === 'dados_invalidos' && mensagem.test(e.message));

test('aceita e normaliza cada tipo de campo', () => {
  const v = validarCampos(CAMPOS, {
    nome: '  Sala 1 ', uf: 'ce', vagas: 10, largura: 2.5, aberta: true, zonaId: ID, inicio: '2027-03-01T09:00:00-03:00',
    prazo: '2027-02-28', site: 'https://exemplo.com.br', cnpj: '11.222.333/0001-81', modo: 'a',
    recursos: ['libras', 'libras', 'legenda'], destaques: [' um ', 'dois'],
  }, 'criar');
  assert.deepEqual(v, {
    nome: 'Sala 1', uf: 'CE', vagas: 10, largura: 2.5, aberta: true, zonaId: ID.toLowerCase(), inicio: '2027-03-01T12:00:00.000Z',
    prazo: '2027-02-28', site: 'https://exemplo.com.br', cnpj: '11222333000181', modo: 'a',
    recursos: ['libras', 'legenda'], destaques: ['um', 'dois'],
  });
});

test('ao criar exige os obrigatórios; ao alterar aceita parte, mas não nada', () => {
  recusa({}, /Nome: preencha/, 'criar');
  assert.deepEqual(validarCampos(CAMPOS, { vagas: 3 }, 'alterar'), { vagas: 3 });
  assert.deepEqual(validarCampos(CAMPOS, { nome: 'Só nome' }, 'criar'), { nome: 'Só nome' });
  recusa({}, /Nada para alterar/);
});

test('nulo e texto vazio limpam campo opcional, nunca o obrigatório', () => {
  assert.deepEqual(validarCampos(CAMPOS, { uf: '', zonaId: null }, 'alterar'), { uf: null, zonaId: null });
  recusa({ nome: null }, /Nome: preencha/);
  recusa({ nome: '   ' }, /Nome: preencha/);
});

test('recusa corpo que não é objeto e campo desconhecido', () => {
  for (const corpo of [null, 'texto', [1], 3]) recusa(corpo, /Envie os dados em JSON/);
  recusa({ nome: 'Sala', situacao: 'vendido' }, /Campo desconhecido: situacao/);
  recusa({ constructor: 1 }, /Campo desconhecido/);
});

test('cada tipo explica o que está errado, com o nome do campo', () => {
  recusa({ nome: 5 }, /Nome: escreva um texto/);
  recusa({ nome: 'A' }, /Nome: use pelo menos 2 letras/);
  recusa({ nome: 'Um nome comprido' }, /Nome: use até 10 letras/);
  recusa({ uf: 'C1' }, /UF: formato inválido/);
  recusa({ vagas: 1.5 }, /Vagas: informe um número inteiro/);
  recusa({ vagas: '3' }, /Vagas: informe um número inteiro/);
  recusa({ vagas: -1 }, /Vagas: o mínimo é 0/);
  recusa({ vagas: 101 }, /Vagas: o máximo é 100/);
  recusa({ largura: Number.NaN }, /Largura: informe um número\./);
  recusa({ largura: 0.1 }, /Largura: o mínimo é 0.5/);
  recusa({ aberta: 'sim' }, /Aberta: responda sim ou não/);
  recusa({ zonaId: 'abc' }, /Zona: escolha um item/);
  recusa({ zonaId: 7 }, /Zona: escolha um item/);
  recusa({ inicio: 'amanhã' }, /Início: informe data e hora/);
  recusa({ inicio: 20270301 }, /Início: informe data e hora/);
  recusa({ prazo: '2027-02-30' }, /Prazo: informe uma data/);
  recusa({ prazo: '28/02/2027' }, /Prazo: informe uma data/);
  recusa({ site: 'http://exemplo.com.br' }, /Site: informe um endereço/);
  recusa({ site: 'nada' }, /Site: informe um endereço/);
  recusa({ site: 9 }, /Site: informe um endereço/);
  recusa({ cnpj: '11.222.333/0001-82' }, /CNPJ: confira/);
  recusa({ cnpj: 11222333000181 }, /CNPJ: confira/);
  recusa({ modo: 'c' }, /Modo: escolha uma das opções/);
  recusa({ modo: 1 }, /Modo: escolha uma das opções/);
  recusa({ recursos: 'libras' }, /Recursos: escolha entre as opções/);
  recusa({ recursos: ['braile'] }, /Recursos: escolha entre as opções/);
  recusa({ destaques: ['a', 'b', 'c'] }, /Destaques: liste até 2 itens/);
  recusa({ destaques: 'a' }, /Destaques: liste até 2 itens/);
  recusa({ destaques: ['comprido demais'] }, /Destaques: cada item/);
  recusa({ destaques: [3] }, /Destaques: cada item/);
});

test('CNPJ: confere os dígitos e recusa sequência repetida', () => {
  assert.equal(cnpjValido('11.222.333/0001-81'), '11222333000181');
  assert.equal(cnpjValido('11111111111111'), null);
  assert.equal(cnpjValido('123'), null);
  assert.equal(cnpjValido('00000000000191'), '00000000000191');
});

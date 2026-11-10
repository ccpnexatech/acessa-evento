import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroGrafo, eResposta, validarCanais, validarGrafo } from './grafo.ts';

const resposta = (titulo: string) => ({ tipo: 'resposta', titulo, texto: `Texto de ${titulo}.`, revisadaEm: '2026-11-01' });
const valido = {
  inicio: 'inicio',
  nos: {
    inicio: { tipo: 'pergunta', texto: ' Sobre o que é? ', opcoes: [{ rotulo: 'Acessibilidade', destino: 'acess' }, { rotulo: 'Certificado', destino: 'r-cert' }] },
    acess: { tipo: 'pergunta', texto: 'Qual recurso?', opcoes: [{ rotulo: 'Libras', destino: 'r-libras' }, { rotulo: 'Certificado', destino: 'r-cert' }] },
    'r-libras': resposta('Libras'),
    'r-cert': resposta('Certificado'),
  },
};
const erro = (v: unknown) => {
  try {
    validarGrafo(v);
  } catch (e) {
    assert.ok(e instanceof ErroGrafo);
    return e.message;
  }
  return '';
};
const comNos = (nos: Record<string, unknown>, inicio = 'inicio') => ({ inicio, nos: { ...valido.nos, ...nos } });

test('aceita um grafo válido, com nós compartilhados, e apara os textos', () => {
  const g = validarGrafo(valido);
  assert.equal(g.nos['inicio']?.tipo === 'pergunta' && g.nos['inicio'].texto, 'Sobre o que é?');
  assert.equal(eResposta(g, 'r-libras'), true);
  assert.equal(eResposta(g, 'inicio'), false);
  assert.equal(eResposta(g, 'nao-existe'), false);
});

test('recusa estrutura, ids, tipos e textos inválidos', () => {
  assert.match(erro(null), /inicio/);
  assert.match(erro({ inicio: 'a', nos: {} }), /de 1 a/);
  assert.match(erro(comNos({ 'Com Espaço': resposta('x') })), /Id/);
  assert.match(erro(comNos({ x: 'texto' })), /inválido/);
  assert.match(erro(comNos({ x: { tipo: 'outro' } })), /tipo/);
  assert.match(erro(comNos({}, 'nao-existe')), /início/);
  assert.match(erro(comNos({}, 'r-cert')), /pergunta/);
  assert.match(erro(comNos({ inicio: { tipo: 'pergunta', texto: 'x', opcoes: [{ rotulo: 'a', destino: 'acess' }] } })), /2 a 8/);
  assert.match(erro(comNos({ inicio: { tipo: 'pergunta', texto: '', opcoes: valido.nos.inicio.opcoes } })), /texto obrigatório/);
  assert.match(erro(comNos({ inicio: { tipo: 'pergunta', texto: 'x', opcoes: [{ rotulo: 'a', destino: 'Mau' }, { rotulo: 'b', destino: 'acess' }] } })), /destino inválido/);
  assert.match(erro(comNos({ inicio: { tipo: 'pergunta', texto: 'x', opcoes: [{ rotulo: 'a', destino: 'sumiu' }, { rotulo: 'b', destino: 'acess' }] } })), /não existe/);
  assert.match(erro(comNos({ 'r-cert': { ...resposta('c'), revisadaEm: 'ontem' } })), /revisadaEm/);
});

test('recusa ciclo, caminho longo demais e nó solto', () => {
  assert.match(erro(comNos({ acess: { tipo: 'pergunta', texto: 'x', opcoes: [{ rotulo: 'volta', destino: 'inicio' }, { rotulo: 'b', destino: 'r-cert' }] } })), /ciclo/);
  const longo: Record<string, unknown> = { 'r-fim': resposta('fim') };
  for (let i = 0; i < 7; i++) longo[`p${i}`] = { tipo: 'pergunta', texto: 'x', opcoes: [{ rotulo: 'a', destino: i === 6 ? 'r-fim' : `p${i + 1}` }, { rotulo: 'b', destino: 'r-fim' }] };
  assert.match(erro({ inicio: 'p0', nos: longo }), /mais de 6/);
  assert.match(erro(comNos({ solto: resposta('solto') })), /ninguém alcança: solto/);
});

test('canais: tipos, e-mail e telefone', () => {
  assert.equal(validarCanais([{ tipo: 'email', rotulo: 'E-mail', valor: 'a@b.co' }, { tipo: 'whatsapp', rotulo: 'Zap', valor: '+55 85 90000-0000' }, { tipo: 'balcao', rotulo: 'Balcão', valor: 'Entrada' }]).length, 3);
  for (const ruim of [[], null, [{ tipo: 'fax', rotulo: 'x', valor: 'y' }], [{ tipo: 'email', rotulo: 'x', valor: 'sem-arroba' }], [{ tipo: 'telefone', rotulo: 'x', valor: 'abc' }], [null]]) {
    assert.throws(() => validarCanais(ruim), ErroGrafo);
  }
});

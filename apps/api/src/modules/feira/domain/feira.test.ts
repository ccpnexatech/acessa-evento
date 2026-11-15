import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  proximoNivel, validarAlteracaoDeContrato, validarAnalise, validarMontagem, validarNovoContrato, validarPerfil,
  validarQuantidade, validarReferencia, validarSituacaoDoPedido,
} from './feira.ts';

const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const invalido = (f: () => unknown, mensagem: RegExp) =>
  assert.throws(f, (e: { codigo?: string; message: string }) => e.codigo === 'dados_invalidos' && mensagem.test(e.message));

test('perfil da marca: enviado inteiro; logo só com descrição', () => {
  assert.deepEqual(validarPerfil({ nomeExibicao: 'Xis Med' }), {
    nomeExibicao: 'Xis Med', logoUrl: null, logoDescricao: null, segmentoId: null, frase: null, destaques: [], site: null, contato: null, publicado: false,
  });
  const completo = validarPerfil({ nomeExibicao: 'Xis Med', logoUrl: 'https://exemplo.com.br/x.png', logoDescricao: 'Letra X azul', destaques: ['Monitores'], publicado: true, segmentoId: ID(1) });
  assert.deepEqual([completo['logoDescricao'], completo['destaques'], completo['publicado'], completo['segmentoId']], ['Letra X azul', ['Monitores'], true, ID(1)]);
  // Descrição sem logo não é guardada: não há o que descrever.
  assert.equal(validarPerfil({ nomeExibicao: 'Xis Med', logoDescricao: 'Sobrou' })['logoDescricao'], null);
  invalido(() => validarPerfil({ nomeExibicao: 'Xis Med', logoUrl: 'https://exemplo.com.br/x.png' }), /Descrição do logo: descreva o logo/);
  invalido(() => validarPerfil({}), /Nome no app: preencha/);
});

test('montagem: a básica descarta o que não se aplica; as outras guardam projeto, ART e termo', () => {
  assert.deepEqual(validarMontagem({ tipo: 'basica', montadora: 'Sobra', termoAceito: true }), { tipo: 'basica', montadora: null, projetoUrl: null, artRrt: null, termoAceito: false });
  assert.deepEqual(validarMontagem({ tipo: 'montadora_propria', montadora: 'Monta Bem', projetoUrl: 'https://exemplo.com.br/p.pdf', artRrt: 'ART 123', termoAceito: true }),
    { tipo: 'montadora_propria', montadora: 'Monta Bem', projetoUrl: 'https://exemplo.com.br/p.pdf', artRrt: 'ART 123', termoAceito: true });
  assert.deepEqual(validarMontagem({ tipo: 'estande_diferente' }), { tipo: 'estande_diferente', montadora: null, projetoUrl: null, artRrt: null, termoAceito: false });
  invalido(() => validarMontagem({ tipo: 'propria' }), /Tipo de montagem/);
});

test('quantidade, situação do pedido e análise de montagem', () => {
  assert.equal(validarQuantidade({ quantidade: 4 }), 4);
  for (const q of [0, 1000, 1.5, '4']) invalido(() => validarQuantidade({ quantidade: q }), /Quantidade/);
  invalido(() => validarQuantidade(null), /Quantidade/);
  assert.equal(validarSituacaoDoPedido({ situacao: 'confirmado' }), 'confirmado');
  invalido(() => validarSituacaoDoPedido({ situacao: 'pago' }), /Situação/);
  invalido(() => validarSituacaoDoPedido(null), /Situação/);
  assert.deepEqual(validarAnalise({ aprovar: true }), { aprovar: true, observacao: null });
  assert.deepEqual(validarAnalise({ aprovar: false, observacao: ' Altura acima de 4 m ' }), { aprovar: false, observacao: 'Altura acima de 4 m' });
  invalido(() => validarAnalise({ aprovar: false }), /diga o que precisa ser corrigido/);
  invalido(() => validarAnalise({ aprovar: 'sim' }), /Decisão/);
  invalido(() => validarAnalise(null), /Decisão/);
  invalido(() => validarAnalise({ aprovar: true, observacao: 'x'.repeat(501) }), /até 500/);
});

test('contrato: um contratado e uma origem do texto, nunca os dois', () => {
  assert.deepEqual(validarNovoContrato({ parceiroEventoId: ID(1), modeloContratoId: ID(2), valorCentavos: 3600000 }),
    { parceiroEventoId: ID(1), palestranteId: null, modeloContratoId: ID(2), corpo: null, valorCentavos: 3600000, via: 'aceite_no_app' });
  const escrito = validarNovoContrato({ palestranteId: ID(3), corpo: 'Contrato de participação como palestrante.', via: 'govbr_manual' });
  assert.deepEqual([escrito.palestranteId, escrito.valorCentavos, escrito.via], [ID(3), 0, 'govbr_manual']);
  invalido(() => validarNovoContrato({ modeloContratoId: ID(2) }), /Contratado: escolha um parceiro ou um palestrante/);
  invalido(() => validarNovoContrato({ parceiroEventoId: ID(1), palestranteId: ID(3), modeloContratoId: ID(2) }), /Contratado/);
  invalido(() => validarNovoContrato({ parceiroEventoId: ID(1) }), /Texto do contrato: escolha um modelo ou escreva/);
  invalido(() => validarNovoContrato({ parceiroEventoId: ID(1), modeloContratoId: ID(2), corpo: 'Contrato escrito à mão também.' }), /Texto do contrato/);
  assert.deepEqual(validarAlteracaoDeContrato({ valorCentavos: 10 }), { valorCentavos: 10 });
  invalido(() => validarAlteracaoDeContrato({ situacao: 'assinado' }), /Campo desconhecido/);
  assert.equal(validarReferencia({ referencia: ' gov.br 2027-000123 ' }), 'gov.br 2027-000123');
  invalido(() => validarReferencia({}), /Protocolo/);
  invalido(() => validarReferencia(null), /Protocolo/);
});

test('próximo nível: quanto falta, ou nada quando já está no topo', () => {
  const niveis = [{ nome: 'Ouro', investimentoMinimoCentavos: 3000000 }, { nome: 'Bronze', investimentoMinimoCentavos: 0 }, { nome: 'Prata', investimentoMinimoCentavos: 1000000 }];
  assert.deepEqual(proximoNivel(600000, niveis), { nome: 'Prata', faltamCentavos: 400000 });
  assert.deepEqual(proximoNivel(1000000, niveis), { nome: 'Ouro', faltamCentavos: 2000000 });
  assert.equal(proximoNivel(3600000, niveis), null);
  assert.equal(proximoNivel(0, []), null);
});

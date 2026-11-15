import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENTO_DA_MEIA, decidir, validarConferencia, validarEmissao, validarExcecao, validarLeituras, validarMotivo, validarRegras } from './acessos.ts';
import type { Excecao, Regra } from './acessos.ts';

const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const invalido = (f: () => unknown, mensagem: RegExp) =>
  assert.throws(f, (e: { codigo?: string; message: string }) => e.codigo === 'dados_invalidos' && mensagem.test(e.message));
const AGORA = Date.parse('2027-03-01T12:00:00Z');

/**
 * Casos da regra de acesso. São os mesmos do teste de integração de `pode_entrar`
 * (test/integracao/acessos.int.ts) e do leitor no app: três implementações, uma regra.
 */
test('decidir: revogada, entrada do evento, zona aberta, regra, janela e exceção', () => {
  const [geral, vip, palco] = [{ id: 'geral', aberta: true }, { id: 'vip', aberta: false }, { id: 'palco', aberta: false }];
  const regras: Regra[] = [
    { zonaId: 'vip', categoria: 'palestrante', de: null, ate: null },
    { zonaId: 'palco', categoria: 'seguranca', de: null, ate: null },
    { zonaId: 'palco', categoria: 'montagem', de: '2027-02-27T00:00:00Z', ate: '2027-03-01T00:00:00Z' },
  ];
  const excecoes: Excecao[] = [
    { credencialId: 'caio', zonaId: 'vip', efeito: 'permite' },
    { credencialId: 'duda', zonaId: 'palco', efeito: 'nega' },
  ];
  const caio = { id: 'caio', categoria: 'congressista', revogada: false } as const;
  const duda = { id: 'duda', categoria: 'seguranca', revogada: false } as const;
  const rui = { id: 'rui', categoria: 'seguranca', revogada: false } as const;
  const montador = { id: 'eva', categoria: 'montagem', revogada: false } as const;
  const d = (c: Parameters<typeof decidir>[0], z: Parameters<typeof decidir>[1], quando = AGORA) => decidir(c, z, regras, excecoes, quando);
  assert.deepEqual(d(caio, null), { entra: true });
  assert.deepEqual(d(caio, geral), { entra: true });
  assert.deepEqual(d(caio, palco), { entra: false, motivo: 'sem_regra' });
  assert.deepEqual(d(caio, vip), { entra: true });                               // exceção libera
  assert.deepEqual(d(rui, palco), { entra: true });                              // regra da categoria
  assert.deepEqual(d(rui, vip), { entra: false, motivo: 'sem_regra' });
  assert.deepEqual(d(duda, palco), { entra: false, motivo: 'excecao' });         // exceção barra
  assert.deepEqual(d(montador, palco, Date.parse('2027-02-28T10:00:00Z')), { entra: true });
  assert.deepEqual(d(montador, palco), { entra: false, motivo: 'sem_regra' });   // janela fechou
  assert.deepEqual(d(montador, palco, Date.parse('2027-02-26T10:00:00Z')), { entra: false, motivo: 'sem_regra' }); // ainda não abriu
  assert.deepEqual(d({ ...caio, revogada: true }, null), { entra: false, motivo: 'credencial_revogada' });
  assert.deepEqual(d({ ...caio, revogada: true }, vip), { entra: false, motivo: 'credencial_revogada' });
  assert.deepEqual(d(caio, undefined), { entra: false, motivo: 'zona_desconhecida' });
});

test('regras da zona: lista inteira, categoria única e janela em ordem', () => {
  assert.deepEqual(validarRegras({ regras: [{ categoria: 'palestrante' }, { categoria: 'montagem', de: '2027-02-27T00:00:00-03:00', ate: '2027-03-01T00:00:00-03:00' }] }), [
    { categoria: 'palestrante', de: null, ate: null },
    { categoria: 'montagem', de: '2027-02-27T03:00:00.000Z', ate: '2027-03-01T03:00:00.000Z' },
  ]);
  assert.deepEqual(validarRegras({ regras: [] }), []);
  invalido(() => validarRegras({}), /Regras: envie a lista/);
  invalido(() => validarRegras({ regras: [{ categoria: 'penetra' }] }), /Categoria: escolha/);
  invalido(() => validarRegras({ regras: [null] }), /Categoria: escolha/);
  invalido(() => validarRegras({ regras: [{ categoria: 'equipe' }, { categoria: 'equipe' }] }), /uma vez só/);
  invalido(() => validarRegras({ regras: [{ categoria: 'equipe', de: 'ontem' }] }), /Entra a partir de: informe data e hora/);
  invalido(() => validarRegras({ regras: [{ categoria: 'equipe', ate: 5 }] }), /Entra até: informe data e hora/);
  invalido(() => validarRegras({ regras: [{ categoria: 'equipe', de: '2027-03-02T00:00:00Z', ate: '2027-03-01T00:00:00Z' }] }), /Entra até: precisa ser depois/);
});

test('emissão, motivo, exceção e conferência', () => {
  assert.deepEqual(validarEmissao({ email: 'duda@exemplo.com.br', categoria: 'seguranca' }), { emailBruto: 'duda@exemplo.com.br', categoria: 'seguranca' });
  invalido(() => validarEmissao({ email: 'x@exemplo.com.br', categoria: 'congressista' }), /Congressista recebe a credencial ao se inscrever/);
  invalido(() => validarEmissao(null), /Categoria/);
  assert.equal(validarMotivo({ motivo: ' Fora da escala ' }), 'Fora da escala');
  invalido(() => validarMotivo({ motivo: 'x' }), /Motivo: use de 3 a 200/);
  invalido(() => validarMotivo([]), /Motivo/);
  assert.deepEqual(validarExcecao({ efeito: 'permite', motivo: 'Homenageado da noite' }), { efeito: 'permite', motivo: 'Homenageado da noite' });
  invalido(() => validarExcecao({ efeito: 'talvez', motivo: 'Homenageado' }), /Efeito: escolha liberar ou barrar/);
  invalido(() => validarExcecao({ efeito: 'nega' }), /Motivo/);
  assert.equal(validarConferencia({ resultado: 'confirmada' }), 'confirmada');
  invalido(() => validarConferencia({ resultado: 'ok' }), /Resultado/);
  assert.ok(Object.values(DOCUMENTO_DA_MEIA).every((d) => d.length > 5));
});

test('leituras: por credencial ou ingresso, com ponto ou nome do portão', () => {
  const base = { id: ID(1), credencialId: ID(2), pontoId: ID(3), metodo: 'qr', feitoEm: '2027-03-01T11:00:00Z' };
  assert.deepEqual(validarLeituras({ leituras: [base] }, AGORA), [{
    id: ID(1), credencialId: ID(2), ingressoId: null, pontoId: ID(3), portao: null, sentido: 'entrada', resultado: 'liberado', metodo: 'qr', feitoEm: '2027-03-01T11:00:00.000Z',
  }]);
  const v1 = validarLeituras({ leituras: [{ id: ID(1), ingressoId: ID(4).toUpperCase(), portao: ' Portão 1 ', metodo: 'manual', documentoConferido: true, sentido: 'saida', feitoEm: '2027-03-01T11:00:00Z' }] }, AGORA);
  assert.deepEqual([v1[0]?.ingressoId, v1[0]?.portao, v1[0]?.sentido, v1[0]?.pontoId], [ID(4), 'Portão 1', 'saida', null]);
  // Barrar à mão não pede documento; liberar à mão pede.
  assert.equal(validarLeituras({ leituras: [{ ...base, metodo: 'manual', resultado: 'negado' }] }, AGORA).length, 1);
  invalido(() => validarLeituras({ leituras: [{ ...base, metodo: 'manual' }] }, AGORA), /confira um documento/);
  invalido(() => validarLeituras({}, AGORA), /Envie a lista de leituras/);
  invalido(() => validarLeituras({ leituras: [] }, AGORA), /Envie a lista/);
  invalido(() => validarLeituras({ leituras: Array.from({ length: 201 }, () => base) }, AGORA), /no máximo 200/);
  invalido(() => validarLeituras({ leituras: [{ ...base, id: 'x' }] }, AGORA), /Leitura 1: id inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, id: undefined }] }, AGORA), /Leitura 1: id inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, credencialId: 7 }] }, AGORA), /credencialId inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, ingressoId: ID(4) }] }, AGORA), /informe a credencial ou o ingresso/);
  invalido(() => validarLeituras({ leituras: [{ ...base, credencialId: null }] }, AGORA), /informe a credencial ou o ingresso/);
  invalido(() => validarLeituras({ leituras: [{ ...base, pontoId: null }] }, AGORA), /informe o ponto de leitura/);
  invalido(() => validarLeituras({ leituras: [{ ...base, sentido: 'lado' }] }, AGORA), /sentido inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, resultado: 'talvez' }] }, AGORA), /resultado inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, metodo: 'nfc' }] }, AGORA), /método inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, feitoEm: '2027-03-01T13:00:00Z' }] }, AGORA), /horário inválido/);
  invalido(() => validarLeituras({ leituras: [{ ...base, feitoEm: 9 }] }, AGORA), /horário inválido/);
});

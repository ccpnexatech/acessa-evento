import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificadorPorEmail, textoRecibo } from './recibo.ts';
import { CARTAO_RECUSADO_FINAL, pagamentoSimulado } from './pagamento-simulado.ts';

const recibo = { evento: 'COCAL 2026', tipo: 'Congressista', valorCentavos: 45000, metodo: 'pix' as const, pedidoId: 'p1' };

test('recibo diz o evento, o valor em reais e que nada foi cobrado', () => {
  const { assunto, texto } = textoRecibo(recibo);
  assert.equal(assunto, 'Você está no COCAL 2026');
  assert.match(texto, /R\$\s450,00 \(Pix\)/);
  assert.match(textoRecibo({ ...recibo, metodo: 'cartao' }).texto, /\(cartão\)/);
  assert.match(texto, /nenhum dinheiro foi cobrado/);
});

test('envia para o e-mail da pessoa; sem e-mail, não envia', async () => {
  const enviados: string[] = [];
  const n = notificadorPorEmail({ emailDe: async (id) => (id === 'p1' ? 'ana@exemplo.com.br' : null), enviar: async (para) => void enviados.push(para) });
  await n.recibo('p1', recibo);
  await n.recibo('p2', recibo);
  assert.deepEqual(enviados, ['ana@exemplo.com.br']);
});

test('pagamento simulado: Pix e cartão comum aprovam, final 0002 recusa, mesma chave não cobra de novo', async () => {
  const p = pagamentoSimulado();
  const base = { valorCentavos: 100, descricao: 'x' };
  assert.equal((await p.cobrar({ ...base, chave: 'a'.repeat(16), metodo: 'pix', cartao: null })).aprovado, true);
  assert.equal((await p.cobrar({ ...base, chave: 'b'.repeat(16), metodo: 'cartao', cartao: { numero: '4242424242424242' } })).aprovado, true);
  const recusa = await p.cobrar({ ...base, chave: 'c'.repeat(16), metodo: 'cartao', cartao: { numero: `400000000000${CARTAO_RECUSADO_FINAL}` } });
  assert.equal(recusa.aprovado, false);
  assert.deepEqual(await p.cobrar({ ...base, chave: 'c'.repeat(16), metodo: 'pix', cartao: null }), recusa);
  assert.equal(p.cobrancas, 3);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroCredenciamento, MAXIMO_POR_LOTE, situacoes, validarLote } from './credenciamento.ts';

const AGORA = Date.parse('2026-07-01T15:00:00Z');
const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ok = { id: ID(1), ingressoId: ID(100), portao: ' Portão 1 ', metodo: 'qr', feitoEm: '2026-07-01T11:12:00-03:00' };
const msg = (corpo: unknown) => {
  try {
    validarLote(corpo, AGORA);
  } catch (e) {
    assert.ok(e instanceof ErroCredenciamento);
    return e.message;
  }
  return '';
};

test('aceita o lote e normaliza portão e horário', () => {
  assert.deepEqual(validarLote({ checkins: [ok] }, AGORA), [{ id: ID(1), ingressoId: ID(100), portao: 'Portão 1', metodo: 'qr', feitoEm: '2026-07-01T14:12:00.000Z' }]);
});

test('manual exige documento conferido', () => {
  assert.match(msg({ checkins: [{ ...ok, metodo: 'manual' }] }), /documento com foto/);
  assert.equal(validarLote({ checkins: [{ ...ok, metodo: 'manual', documentoConferido: true }] }, AGORA)[0]?.metodo, 'manual');
});

test('recusa lote vazio, grande demais e campos inválidos', () => {
  assert.match(msg(null), /lista/);
  assert.match(msg({ checkins: [] }), /lista/);
  assert.match(msg({ checkins: Array.from({ length: MAXIMO_POR_LOTE + 1 }, () => ok) }), /no máximo/);
  assert.match(msg({ checkins: [{ ...ok, id: 'x' }] }), /id inválido/);
  assert.match(msg({ checkins: [{ ...ok, ingressoId: 1 }] }), /ingresso inválido/);
  assert.match(msg({ checkins: [{ ...ok, portao: '' }] }), /portão/);
  assert.match(msg({ checkins: [{ ...ok, metodo: 'nfc' }] }), /método/);
  assert.match(msg({ checkins: [{ ...ok, feitoEm: 'ontem' }] }), /horário/);
  assert.match(msg({ checkins: [{ ...ok, feitoEm: '2026-07-01T16:00:00Z' }] }), /horário/);
  assert.match(msg({ checkins: [null] }), /id inválido/);
});

test('o primeiro pelo horário vale, em qualquer ordem de chegada', () => {
  const a = { id: ID(2), ingressoId: ID(100), feitoEm: '2026-07-01T11:15:00.000Z' };
  const b = { id: ID(1), ingressoId: ID(100), feitoEm: '2026-07-01T11:12:00.000Z' };
  const c = { id: ID(3), ingressoId: ID(101), feitoEm: '2026-07-01T11:20:00.000Z' };
  const esperado = new Map([[ID(1), 'valido'], [ID(2), 'repetido'], [ID(3), 'valido']]);
  assert.deepEqual(situacoes([a, b, c]), esperado);
  assert.deepEqual(situacoes([c, b, a]), esperado);
});

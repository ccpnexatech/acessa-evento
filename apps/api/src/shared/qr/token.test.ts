import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chavePrivadaDeBase64, chavePrivadaParaBase64, assinadorEd25519, novaChavePrivada, verificadorEd25519 } from './ed25519.ts';
import { deBase64url, emitirToken, lerToken, paraBase64url, validadeDoEvento } from './token.ts';

/**
 * Vetor fixo: o app mobile tem um teste com estes mesmos valores.
 * Se o formato mudar de um lado só, um dos dois testes quebra.
 */
const VETOR = {
  privada: 'MC4CAQAwBQYDK2VwBCIEIBERERERERERERERERERERERERERERERERERERERERER',
  kid: 'teste-1',
  ingresso: '01900000-0000-7000-8000-000000000001',
  evento: '01900000-0000-7000-8000-0000000000e1',
  validade: 1_783_123_200,
  publica: '0EqyMnQrtKs6E2i9RhXk5tAiSrcaAWuvhSCjMsl3hzc',
  token: 'AE1.eyJrIjoidGVzdGUtMSIsImkiOiIwMTkwMDAwMC0wMDAwLTcwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJlIjoiMDE5MDAwMDAtMDAwMC03MDAwLTgwMDAtMDAwMDAwMDAwMGUxIiwieCI6MTc4MzEyMzIwMH0.erD5Zz3BC57MheA5-0CHH8a5CpnKv8DAlyLbBOmLGtqfmURvTnLs6uBTHT8Fb1ld73cw3vGftSMpkhdX37saCg',
};

const assinador = assinadorEd25519(VETOR.kid, chavePrivadaDeBase64(VETOR.privada));
const verificador = verificadorEd25519(new Map([[VETOR.kid, assinador.chavePublica]]));
const AGORA = 1_782_000_000;

test('base64url ida e volta em todos os tamanhos', () => {
  for (let n = 0; n < 40; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) % 256);
    assert.deepEqual(deBase64url(paraBase64url(bytes)), bytes);
    assert.equal(paraBase64url(bytes), Buffer.from(bytes).toString('base64url'));
  }
  assert.equal(deBase64url('a+b'), null);
  assert.equal(deBase64url('abcde'), null);
});

test('vetor fixo: o token é determinístico (o mobile confere este mesmo texto)', () => {
  const token = emitirToken({ i: VETOR.ingresso, e: VETOR.evento, x: VETOR.validade }, assinador);
  assert.equal(token, VETOR.token);
  assert.equal(assinador.chavePublica, VETOR.publica);
});

test('aceita o token autêntico do evento dentro da validade', () => {
  const token = emitirToken({ i: VETOR.ingresso, e: VETOR.evento, x: VETOR.validade }, assinador);
  assert.deepEqual(lerToken(token, verificador, VETOR.evento, AGORA), { ok: true, conteudo: { k: VETOR.kid, i: VETOR.ingresso, e: VETOR.evento, x: VETOR.validade } });
});

test('recusa assinatura de outra chave, conteúdo trocado, outro evento, vencido e lixo', () => {
  const token = emitirToken({ i: VETOR.ingresso, e: VETOR.evento, x: VETOR.validade }, assinador);
  const intruso = emitirToken({ i: VETOR.ingresso, e: VETOR.evento, x: VETOR.validade }, { ...assinadorEd25519(VETOR.kid, novaChavePrivada()) });
  assert.deepEqual(lerToken(intruso, verificador, VETOR.evento, AGORA), { ok: false, motivo: 'assinatura' });
  const [p, , s] = token.split('.');
  const outro = paraBase64url(new TextEncoder().encode(JSON.stringify({ k: VETOR.kid, i: 'outro', e: VETOR.evento, x: VETOR.validade })));
  assert.deepEqual(lerToken(`${p}.${outro}.${s}`, verificador, VETOR.evento, AGORA), { ok: false, motivo: 'assinatura' });
  assert.deepEqual(lerToken(token, verificador, 'outro-evento', AGORA), { ok: false, motivo: 'outro_evento' });
  assert.deepEqual(lerToken(token, verificador, VETOR.evento, VETOR.validade + 1), { ok: false, motivo: 'vencido' });
  const kidDesconhecido = emitirToken({ i: 'x', e: VETOR.evento, x: VETOR.validade }, { ...assinador, kid: 'velha' });
  assert.deepEqual(lerToken(kidDesconhecido, verificador, VETOR.evento, AGORA), { ok: false, motivo: 'assinatura' });
  for (const lixo of ['', 'oi', 'AE2.a.b', 'AE1.@@.b', 'AE1.e30.' + 'A'.repeat(86), `AE1.${paraBase64url(new TextEncoder().encode('{"k":1}'))}.${'A'.repeat(86)}`, `AE1.${paraBase64url(Uint8Array.of(255))}.${'A'.repeat(86)}`]) {
    assert.equal(lerToken(lixo, verificador, VETOR.evento, AGORA).ok, false, lixo);
  }
});

test('chave privada ida e volta; recusa chave que não é Ed25519', () => {
  const k = novaChavePrivada();
  assert.equal(assinadorEd25519('a', chavePrivadaDeBase64(chavePrivadaParaBase64(k))).chavePublica, assinadorEd25519('a', k).chavePublica);
  assert.throws(() => assinadorEd25519('a', { asymmetricKeyType: 'rsa' } as never), /Ed25519/);
});

test('validade cobre o último dia do evento com folga', () => {
  assert.equal(validadeDoEvento('2026-07-03'), Date.parse('2026-07-05T00:00:00Z') / 1000);
});

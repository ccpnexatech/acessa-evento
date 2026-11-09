/** Tokens assinados de verdade para os testes do credenciamento. */
import { ed25519 } from '@noble/curves/ed25519';
import { paraBase64url } from './token';
import type { Pacote } from './modelo';

const PRIVADA = new Uint8Array(32).fill(7);
const ascii = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0));

export const CHAVE = { kid: 'k1', publica: paraBase64url(ed25519.getPublicKey(PRIVADA)) };
export const EVENTO_ID = '01900000-0000-7000-8000-0000000000e1';
export const CAIO = '01900000-0000-7000-8000-000000000001';
export const ANA = '01900000-0000-7000-8000-000000000002';
export const NOVO = '01900000-0000-7000-8000-000000000003';
export const AGORA = Date.parse('2026-07-01T12:00:00Z');

export function token(ingresso: string, { evento = EVENTO_ID, validade = AGORA / 1000 + 86_400, privada = PRIVADA } = {}): string {
  const conteudo = paraBase64url(ascii(JSON.stringify({ k: CHAVE.kid, i: ingresso, e: evento, x: validade })));
  return `AE1.${conteudo}.${paraBase64url(ed25519.sign(ascii(`AE1.${conteudo}`), privada))}`;
}

export const PACOTE: Pacote = {
  evento: { id: EVENTO_ID, slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03' },
  chaves: [CHAVE],
  geradoEm: '2026-07-01T11:00:00.000Z',
  participantes: [
    { ingressoId: CAIO, nome: 'Caio Ponte', tipo: 'Congressista', recursos: ['libras'], checkin: null },
    { ingressoId: ANA, nome: 'Ana Lima', tipo: 'Estudante', recursos: [], checkin: { em: '2026-07-01T11:12:00.000Z', portao: 'Portão 2' } },
  ],
};

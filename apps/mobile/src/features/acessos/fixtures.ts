/** Pacote e QR assinados de verdade para os testes do leitor por ponto. */
import { ed25519 } from '@noble/curves/ed25519';
import { paraBase64url } from '../credenciamento/token';
import type { PacoteAcessos } from './leitor';

const PRIVADA = new Uint8Array(32).fill(9);
const ascii = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0));
const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;

export const EVENTO_ID = ID(1);
export const AGORA = Date.parse('2027-03-01T12:00:00Z');
export const CRED = { caio: ID(10), duda: ID(11), eva: ID(12), cancelada: ID(13) };
export const INGRESSO_CAIO = ID(20);
export const ZONA = { geral: ID(30), vip: ID(31) };
export const PONTO = { portao1: ID(40), portao2: ID(41), portaVip: ID(42), salaVip: ID(43) };

/** QR de ingresso (`i`) ou de credencial sem ingresso (`c`), como a API emite. */
export function qr(alvo: { i: string } | { c: string }, { evento = EVENTO_ID, validade = AGORA / 1000 + 86_400 } = {}): string {
  const conteudo = paraBase64url(ascii(JSON.stringify({ k: 'k1', ...alvo, e: evento, x: validade })));
  return `AE1.${conteudo}.${paraBase64url(ed25519.sign(ascii(`AE1.${conteudo}`), PRIVADA))}`;
}

export const PACOTE: PacoteAcessos = {
  evento: { id: EVENTO_ID, slug: 'jornada-2027', nome: 'Jornada 2027', inicio: '2027-03-01', fim: '2027-03-03' },
  chaves: [{ kid: 'k1', publica: paraBase64url(ed25519.getPublicKey(PRIVADA)) }],
  credenciais: [
    { id: CRED.caio, ingressoId: INGRESSO_CAIO, nome: 'Caio Ponte', categoria: 'congressista', tipo: 'Meia', recursos: ['libras'], revogada: false, entrada: null },
    { id: CRED.duda, ingressoId: null, nome: 'Duda Reis', categoria: 'seguranca', tipo: null, recursos: [], revogada: false, entrada: { em: '2027-03-01T10:00:00.000Z', portao: 'Portão 2' } },
    { id: CRED.eva, ingressoId: null, nome: 'Eva Lima', categoria: 'palestrante', tipo: null, recursos: [], revogada: false, entrada: null },
    { id: CRED.cancelada, ingressoId: null, nome: 'Rui Alves', categoria: 'montagem', tipo: null, recursos: [], revogada: true, entrada: null },
  ],
  zonas: [{ id: ZONA.geral, nome: 'Área geral', aberta: true }, { id: ZONA.vip, nome: 'Sala VIP', aberta: false }],
  regras: [{ zonaId: ZONA.vip, categoria: 'palestrante', de: null, ate: null }],
  excecoes: [],
  pontos: [
    { id: PONTO.portao1, nome: 'Portão 1', zonaId: null, tipo: 'celular', modo: 'entrada_unica' },
    { id: PONTO.portao2, nome: 'Portão 2', zonaId: null, tipo: 'celular', modo: 'entrada_unica' },
    { id: PONTO.portaVip, nome: 'Porta VIP', zonaId: ZONA.vip, tipo: 'celular', modo: 'passagem_livre' },
    { id: PONTO.salaVip, nome: 'Catraca VIP', zonaId: ZONA.vip, tipo: 'celular', modo: 'entrada_unica' },
  ],
  meias: [{ id: ID(50), credencialId: CRED.caio, motivo: 'estudante', resultado: null, documento: 'carteira de estudante' }],
  geradoEm: '2027-03-01T11:00:00.000Z',
};

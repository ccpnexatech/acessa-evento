/** Adaptador Ed25519 com o crypto nativo do Node (sem dependência). */
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { deBase64url, paraBase64url } from './token.ts';
import type { Assinador, Verificador } from './token.ts';

/** Chave pública crua (32 bytes) de uma chave Ed25519. */
export function chavePublicaCrua(chave: KeyObject): Uint8Array {
  const jwk = createPublicKey(chave).export({ format: 'jwk' });
  return deBase64url(jwk.x ?? '') ?? new Uint8Array();
}

export function assinadorEd25519(kid: string, privada: KeyObject): Assinador {
  if (privada.asymmetricKeyType !== 'ed25519') throw new Error('A chave do QR precisa ser Ed25519.');
  return {
    kid,
    chavePublica: paraBase64url(chavePublicaCrua(privada)),
    assinar: (m) => new Uint8Array(sign(null, m, privada)),
  };
}

/** Lê a chave privada em PKCS#8 DER base64 (formato da variável QR_CHAVE_PRIVADA). */
export function chavePrivadaDeBase64(texto: string): KeyObject {
  return createPrivateKey({ key: Buffer.from(texto, 'base64'), format: 'der', type: 'pkcs8' });
}

export function novaChavePrivada(): KeyObject {
  return generateKeyPairSync('ed25519').privateKey;
}

export function chavePrivadaParaBase64(chave: KeyObject): string {
  return chave.export({ format: 'der', type: 'pkcs8' }).toString('base64');
}

export function verificadorEd25519(publicas: ReadonlyMap<string, string>): Verificador {
  const chaves = new Map<string, KeyObject>();
  for (const [kid, x] of publicas) chaves.set(kid, createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }));
  return {
    verificar(kid, mensagem, assinatura) {
      const chave = chaves.get(kid);
      return chave ? verify(null, mensagem, chave, assinatura) : false;
    },
  };
}

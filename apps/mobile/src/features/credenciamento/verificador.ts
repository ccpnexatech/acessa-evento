/**
 * Verificação Ed25519 no aparelho, sem internet. O Hermes não tem WebCrypto
 * com Ed25519, então usamos @noble/curves (auditada, sem dependências nativas),
 * isolada atrás da porta Verificador (ADR 0022).
 */
import { ed25519 } from '@noble/curves/ed25519';
import { deBase64url } from './token';
import type { Verificador } from './token';

export function verificadorNoble(chaves: readonly { kid: string; publica: string }[]): Verificador {
  const publicas = new Map<string, Uint8Array>();
  for (const c of chaves) {
    const bytes = deBase64url(c.publica);
    if (bytes?.length === 32) publicas.set(c.kid, bytes);
  }
  return {
    verificar(kid, mensagem, assinatura) {
      const publica = publicas.get(kid);
      if (!publica) return false;
      try {
        return ed25519.verify(assinatura, mensagem, publica);
      } catch {
        return false;
      }
    },
  };
}

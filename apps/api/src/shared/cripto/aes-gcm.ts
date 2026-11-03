/**
 * AES-256-GCM e HMAC-SHA256 com node:crypto, sem dependências.
 *
 * Formato do cifrado: [versão do formato 1B][id da chave 1B][IV 12B][tag 16B][dados].
 * O id da chave permite rotação: cifra com a chave atual, decifra com qualquer
 * chave ainda registrada.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cifrador, Indexador } from './portas.ts';

const FORMATO = 1;
const IV = 12;
const TAG = 16;

export interface Chaves {
  /** id (1–255) → chave de 32 bytes. */
  readonly cifra: ReadonlyMap<number, Buffer>;
  readonly atual: number;
  /** Chave do índice HMAC; separada da de cifra. */
  readonly indice: Buffer;
}

export class CifradorAesGcm implements Cifrador, Indexador {
  readonly #chaves: Chaves;

  constructor(chaves: Chaves) {
    for (const [id, chave] of chaves.cifra) {
      if (!Number.isInteger(id) || id < 1 || id > 255) throw new Error(`Id de chave inválido: ${id}`);
      if (chave.length !== 32) throw new Error(`A chave ${id} precisa ter 32 bytes.`);
    }
    if (!chaves.cifra.has(chaves.atual)) throw new Error('A chave atual não está registrada.');
    if (chaves.indice.length < 32) throw new Error('A chave de índice precisa ter ao menos 32 bytes.');
    for (const chave of chaves.cifra.values()) {
      if (chave.length === chaves.indice.length && timingSafeEqual(chave, chaves.indice)) {
        throw new Error('A chave de índice não pode ser igual a uma chave de cifra.');
      }
    }
    this.#chaves = chaves;
  }

  cifrar(texto: string, contexto: string): Buffer {
    const id = this.#chaves.atual;
    const iv = randomBytes(IV);
    const cifra = createCipheriv('aes-256-gcm', this.#chave(id), iv);
    cifra.setAAD(Buffer.from(contexto, 'utf8'));
    const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
    return Buffer.concat([Buffer.from([FORMATO, id]), iv, cifra.getAuthTag(), dados]);
  }

  decifrar(cifrado: Buffer, contexto: string): string {
    if (cifrado.length < 2 + IV + TAG || cifrado[0] !== FORMATO) throw new Error('Cifrado em formato desconhecido.');
    const id = cifrado[1] ?? 0;
    const iv = cifrado.subarray(2, 2 + IV);
    const tag = cifrado.subarray(2 + IV, 2 + IV + TAG);
    const decifra = createDecipheriv('aes-256-gcm', this.#chave(id), iv);
    decifra.setAAD(Buffer.from(contexto, 'utf8'));
    decifra.setAuthTag(tag);
    try {
      return Buffer.concat([decifra.update(cifrado.subarray(2 + IV + TAG)), decifra.final()]).toString('utf8');
    } catch {
      throw new Error('Não foi possível decifrar: dado adulterado, chave ou contexto errado.');
    }
  }

  indice(valor: string, contexto: string): Buffer {
    return createHmac('sha256', this.#chaves.indice).update(`${contexto}\u0000${valor}`, 'utf8').digest();
  }

  #chave(id: number): Buffer {
    const chave = this.#chaves.cifra.get(id);
    if (!chave) throw new Error(`Chave ${id} não registrada.`);
    return chave;
  }
}

/**
 * Lê as chaves do ambiente.
 * CHAVES_CIFRA="1:<base64 32B>,2:<base64 32B>" (a de maior id é a atual)
 * CHAVE_INDICE="<base64 ≥32B>"
 * Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export function lerChaves(env: Readonly<Record<string, string | undefined>>): Chaves {
  const texto = env['CHAVES_CIFRA'];
  const indice = env['CHAVE_INDICE'];
  if (!texto || !indice) throw new Error('Defina CHAVES_CIFRA e CHAVE_INDICE.');
  const cifra = new Map<number, Buffer>();
  for (const par of texto.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [id, b64] = par.split(':');
    if (!id || !b64) throw new Error('CHAVES_CIFRA deve ser "id:base64,id:base64".');
    cifra.set(Number(id), Buffer.from(b64, 'base64'));
  }
  return { cifra, atual: Math.max(...cifra.keys()), indice: Buffer.from(indice, 'base64') };
}

/** Normaliza e-mail antes do índice: o mesmo endereço sempre gera o mesmo hash. */
export const normalizarEmail = (email: string): string => email.trim().normalize('NFC').toLowerCase();

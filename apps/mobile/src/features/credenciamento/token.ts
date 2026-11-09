/**
 * Cópia (só leitura) do formato do token do QR definido na API em
 * apps/api/src/shared/qr/token.ts (ADR 0006 e 0022). Puro, sem I/O.
 * O vetor de teste é o mesmo nos dois lados: mudou um, quebra o outro.
 *
 *   AE1.<conteúdo em base64url>.<assinatura Ed25519 em base64url>
 *
 * A assinatura cobre o texto "AE1.<conteúdo>". O conteúdo só tem ids e a
 * validade: o nome e os pedidos de acessibilidade ficam na lista que o
 * aparelho da equipe baixa, não no QR que qualquer câmera lê.
 */
export const PREFIXO = 'AE1';

export interface ConteudoQr {
  /** Id da chave que assinou, para trocar de chave sem invalidar tudo de uma vez. */
  readonly k: string;
  /** Ingresso. */
  readonly i: string;
  /** Evento. */
  readonly e: string;
  /** Validade, em segundos desde 1970. */
  readonly x: number;
}

export interface Verificador {
  verificar(kid: string, mensagem: Uint8Array, assinatura: Uint8Array): boolean;
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function paraBase64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const resto = Math.min(3, bytes.length - i);
    for (let j = 0; j < resto + 1; j++) s += ALFABETO[(n >> (18 - 6 * j)) & 63];
  }
  return s;
}

export function deBase64url(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) return null;
  const saida: number[] = [];
  for (let i = 0; i < texto.length; i += 4) {
    const bloco = texto.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < bloco.length ? ALFABETO.indexOf(bloco[j] ?? '') : 0);
    saida.push((n >> 16) & 255);
    if (bloco.length > 2) saida.push((n >> 8) & 255);
    if (bloco.length > 3) saida.push(n & 255);
  }
  return Uint8Array.from(saida);
}

// O token é todo ASCII; assim não dependemos de TextEncoder/TextDecoder no Hermes.
const ascii = (texto: string): Uint8Array => Uint8Array.from(texto, (c) => c.charCodeAt(0) & 0x7f);
function deAscii(bytes: Uint8Array): string {
  if (bytes.some((b) => b > 0x7f)) throw new Error('não ASCII');
  return String.fromCharCode(...bytes);
}

export type LeituraQr =
  | { readonly ok: true; readonly conteudo: ConteudoQr }
  | { readonly ok: false; readonly motivo: 'formato' | 'assinatura' | 'vencido' | 'outro_evento' };

/** Lê e confere um token; não sabe nada de check-in, só se o ingresso é autêntico e vale aqui. */
export function lerToken(texto: string, verificador: Verificador, eventoId: string, agoraSegundos: number): LeituraQr {
  const partes = texto.trim().split('.');
  if (partes.length !== 3 || partes[0] !== PREFIXO) return { ok: false, motivo: 'formato' };
  const [, conteudoB64 = '', assinaturaB64 = ''] = partes;
  const bytes = deBase64url(conteudoB64);
  const assinatura = deBase64url(assinaturaB64);
  if (!bytes || !assinatura || assinatura.length !== 64) return { ok: false, motivo: 'formato' };
  let conteudo: ConteudoQr;
  try {
    const c = JSON.parse(deAscii(bytes)) as Partial<ConteudoQr>;
    if (typeof c.k !== 'string' || typeof c.i !== 'string' || typeof c.e !== 'string' || typeof c.x !== 'number') return { ok: false, motivo: 'formato' };
    conteudo = { k: c.k, i: c.i, e: c.e, x: c.x };
  } catch {
    return { ok: false, motivo: 'formato' };
  }
  if (!verificador.verificar(conteudo.k, ascii(`${PREFIXO}.${conteudoB64}`), assinatura)) return { ok: false, motivo: 'assinatura' };
  if (conteudo.e !== eventoId) return { ok: false, motivo: 'outro_evento' };
  if (conteudo.x < agoraSegundos) return { ok: false, motivo: 'vencido' };
  return { ok: true, conteudo };
}

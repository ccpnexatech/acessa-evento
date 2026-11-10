/** Lê e valida a configuração do ambiente uma vez, no início (falha cedo). */
import { lerChaves } from '../shared/cripto/aes-gcm.ts';
import type { Chaves } from '../shared/cripto/aes-gcm.ts';
import type { KeyObject } from 'node:crypto';
import { chavePrivadaDeBase64 } from '../shared/qr/ed25519.ts';
import { lerDsn } from '../shared/erros/relator.ts';
import type { Dsn } from '../shared/erros/relator.ts';

export type Ambiente = 'desenvolvimento' | 'teste' | 'producao';

export type ConfigEmail =
  | { readonly provedor: 'dev' }
  | { readonly provedor: 'resend'; readonly chave: string; readonly remetente: string };

export interface ConfigBanco {
  /** Usuário da API (papel app_api). */
  readonly url: string;
  readonly chaves: Chaves;
  readonly email: ConfigEmail;
  /** Chave Ed25519 que assina o QR dos ingressos. Fora de produção, sem ela, a API gera uma temporária. */
  readonly qr?: ConfigQr;
}

export interface ConfigQr {
  readonly kid: string;
  readonly privada: KeyObject;
}

export interface Config {
  readonly porta: number;
  readonly ambiente: Ambiente;
  readonly corsOrigens: readonly string[];
  /** Ausente = a API sobe sem banco e só responde a /saude. */
  readonly banco?: ConfigBanco;
  /** DSN do Sentry; sem ele, erros ficam só no log (ADR 0024). */
  readonly sentryDsn?: Dsn;
}

const AMBIENTES: readonly Ambiente[] = ['desenvolvimento', 'teste', 'producao'];

export function lerConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const erros: string[] = [];

  const portaTexto = env['PORTA'] ?? '3333';
  const porta = Number(portaTexto);
  if (!Number.isInteger(porta) || porta < 0 || porta > 65_535) erros.push(`PORTA inválida: "${portaTexto}"`);

  const ambiente = (env['AMBIENTE'] ?? 'desenvolvimento') as Ambiente;
  if (!AMBIENTES.includes(ambiente)) erros.push(`AMBIENTE inválido: "${ambiente}" (use ${AMBIENTES.join(', ')})`);

  const corsOrigens = (env['CORS_ORIGENS'] ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  for (const o of corsOrigens) {
    if (!/^https?:\/\/[^/\s]+$/.test(o)) erros.push(`CORS_ORIGENS com origem inválida: "${o}"`);
    if (ambiente === 'producao' && o.startsWith('http://')) erros.push(`CORS_ORIGENS sem HTTPS em produção: "${o}"`);
  }

  const url = env['DATABASE_URL'];
  let banco: ConfigBanco | undefined;
  if (url !== undefined) {
    if (!/^postgres(?:ql)?:\/\//.test(url)) erros.push('DATABASE_URL precisa começar com postgres://');
    let chaves: Chaves | undefined;
    try {
      chaves = lerChaves(env);
    } catch (e) {
      erros.push((e as Error).message);
    }
    const email = lerEmail(env, ambiente, erros);
    const qr = lerQr(env, ambiente, erros);
    if (chaves && email) banco = qr ? { url, chaves, email, qr } : { url, chaves, email };
  } else if (ambiente === 'producao') {
    erros.push('DATABASE_URL é obrigatória em produção');
  }

  const textoDsn = env['SENTRY_DSN'];
  const sentryDsn = textoDsn ? lerDsn(textoDsn) : null;
  if (textoDsn && !sentryDsn) erros.push('SENTRY_DSN inválido: use https://<chave>@<host>/<projeto>');

  if (erros.length) throw new Error(`Configuração inválida:\n- ${erros.join('\n- ')}`);
  return { porta, ambiente, corsOrigens, ...(banco ? { banco } : {}), ...(sentryDsn ? { sentryDsn } : {}) };
}

function lerQr(env: Readonly<Record<string, string | undefined>>, ambiente: Ambiente, erros: string[]): ConfigQr | undefined {
  const texto = env['QR_CHAVE_PRIVADA'];
  const kid = env['QR_CHAVE_ID'] ?? 'qr-1';
  if (!texto) {
    if (ambiente === 'producao') erros.push('QR_CHAVE_PRIVADA é obrigatória em produção (Ed25519, PKCS#8 DER em base64)');
    return undefined;
  }
  if (!/^[a-z0-9-]{1,20}$/.test(kid)) erros.push('QR_CHAVE_ID precisa ter de 1 a 20 letras minúsculas, números ou hífen');
  try {
    const privada = chavePrivadaDeBase64(texto);
    if (privada.asymmetricKeyType !== 'ed25519') throw new Error('tipo');
    return { kid, privada };
  } catch {
    erros.push('QR_CHAVE_PRIVADA inválida: use uma chave Ed25519 em PKCS#8 DER base64');
    return undefined;
  }
}

function lerEmail(env: Readonly<Record<string, string | undefined>>, ambiente: Ambiente, erros: string[]): ConfigEmail | undefined {
  const provedor = env['EMAIL_PROVEDOR'] ?? (ambiente === 'producao' ? 'resend' : 'dev');
  if (provedor === 'dev') {
    if (ambiente === 'producao') erros.push('EMAIL_PROVEDOR=dev não é permitido em produção');
    return { provedor: 'dev' };
  }
  if (provedor === 'resend') {
    const chave = env['RESEND_API_KEY'];
    const remetente = env['EMAIL_REMETENTE'];
    if (!chave || !remetente) {
      erros.push('EMAIL_PROVEDOR=resend exige RESEND_API_KEY e EMAIL_REMETENTE');
      return undefined;
    }
    return { provedor: 'resend', chave, remetente };
  }
  erros.push(`EMAIL_PROVEDOR inválido: "${provedor}" (use dev ou resend)`);
  return undefined;
}

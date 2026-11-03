/** Lê e valida a configuração do ambiente uma vez, no início (falha cedo). */
import { lerChaves } from '../shared/cripto/aes-gcm.ts';
import type { Chaves } from '../shared/cripto/aes-gcm.ts';

export type Ambiente = 'desenvolvimento' | 'teste' | 'producao';

export type ConfigEmail =
  | { readonly provedor: 'dev' }
  | { readonly provedor: 'resend'; readonly chave: string; readonly remetente: string };

export interface ConfigBanco {
  /** Usuário da API (papel app_api). */
  readonly url: string;
  readonly chaves: Chaves;
  readonly email: ConfigEmail;
}

export interface Config {
  readonly porta: number;
  readonly ambiente: Ambiente;
  readonly corsOrigens: readonly string[];
  /** Ausente = a API sobe sem banco e só responde a /saude. */
  readonly banco?: ConfigBanco;
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
    if (chaves && email) banco = { url, chaves, email };
  } else if (ambiente === 'producao') {
    erros.push('DATABASE_URL é obrigatória em produção');
  }

  if (erros.length) throw new Error(`Configuração inválida:\n- ${erros.join('\n- ')}`);
  return banco ? { porta, ambiente, corsOrigens, banco } : { porta, ambiente, corsOrigens };
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

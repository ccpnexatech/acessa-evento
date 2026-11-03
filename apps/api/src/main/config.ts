/** Lê e valida a configuração do ambiente uma vez, no início (falha cedo). */
export type Ambiente = 'desenvolvimento' | 'teste' | 'producao';

export interface Config {
  readonly porta: number;
  readonly ambiente: Ambiente;
  readonly corsOrigens: readonly string[];
  /** Usuário da API (papel app_api). Ausente = API sobe sem banco (só /saude). */
  readonly databaseUrl?: string;
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

  const databaseUrl = env['DATABASE_URL'];
  if (databaseUrl !== undefined && !/^postgres(?:ql)?:\/\//.test(databaseUrl)) erros.push('DATABASE_URL precisa começar com postgres://');
  if (ambiente === 'producao' && !databaseUrl) erros.push('DATABASE_URL é obrigatória em produção');

  if (erros.length) throw new Error(`Configuração inválida:\n- ${erros.join('\n- ')}`);
  return databaseUrl ? { porta, ambiente, corsOrigens, databaseUrl } : { porta, ambiente, corsOrigens };
}

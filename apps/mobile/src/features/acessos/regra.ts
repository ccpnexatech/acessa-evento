/**
 * Cópia da regra de acesso da API (apps/api/src/modules/acessos/domain/acessos.ts,
 * ADR 0026), para o leitor decidir sem internet. Os casos de teste são os mesmos
 * nos dois lados e no banco (`pode_entrar`): mudou um, quebra o outro. Puro, sem I/O.
 */
export interface Regra {
  readonly zonaId: string;
  readonly categoria: string;
  readonly de: string | null;
  readonly ate: string | null;
}

export interface Excecao {
  readonly credencialId: string;
  readonly zonaId: string;
  readonly efeito: 'permite' | 'nega';
}

export type MotivoNegado = 'credencial_revogada' | 'sem_regra' | 'excecao' | 'zona_desconhecida';
export type Decisao = { readonly entra: true } | { readonly entra: false; readonly motivo: MotivoNegado };

export function decidir(
  credencial: { readonly id: string; readonly categoria: string; readonly revogada: boolean },
  zona: { readonly id: string; readonly aberta: boolean } | null | undefined,
  regras: readonly Regra[],
  excecoes: readonly Excecao[],
  quandoMs: number,
): Decisao {
  if (credencial.revogada) return { entra: false, motivo: 'credencial_revogada' };
  if (zona === null) return { entra: true };
  if (zona === undefined) return { entra: false, motivo: 'zona_desconhecida' };
  const excecao = excecoes.find((x) => x.credencialId === credencial.id && x.zonaId === zona.id);
  if (excecao) return excecao.efeito === 'permite' ? { entra: true } : { entra: false, motivo: 'excecao' };
  if (zona.aberta) return { entra: true };
  const vale = regras.some((r) => r.zonaId === zona.id && r.categoria === credencial.categoria
    && (r.de === null || Date.parse(r.de) <= quandoMs) && (r.ate === null || Date.parse(r.ate) > quandoMs));
  return vale ? { entra: true } : { entra: false, motivo: 'sem_regra' };
}

/**
 * Domínio da saúde do serviço: regras puras, sem I/O.
 * O estado geral é o pior estado entre as dependências.
 */
export type Estado = 'ok' | 'degradado' | 'falha';

export interface EstadoDependencia {
  readonly nome: string;
  readonly estado: Estado;
  readonly latenciaMs: number;
}

export interface RelatorioSaude {
  readonly estado: Estado;
  readonly versao: string;
  readonly ativoHaSegundos: number;
  readonly dependencias: readonly EstadoDependencia[];
}

const GRAVIDADE: Readonly<Record<Estado, number>> = { ok: 0, degradado: 1, falha: 2 };

export function estadoGeral(dependencias: readonly EstadoDependencia[]): Estado {
  return dependencias.reduce<Estado>(
    (pior, d) => (GRAVIDADE[d.estado] > GRAVIDADE[pior] ? d.estado : pior),
    'ok',
  );
}

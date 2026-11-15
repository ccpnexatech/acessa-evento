/**
 * Tarefas de manutenção do banco, chamadas de hora em hora pelo servidor:
 * expurgo de dados com prazo (ADR 0012 e 0027) e reservas de estande vencidas (ADR 0028).
 * Cada função do banco é idempotente; rodar duas vezes não faz mal.
 */
import type { Banco } from './banco.ts';

export interface ResultadoManutencao {
  readonly acessibilidade: number;
  readonly meia: number;
  readonly reservas: number;
}

export async function rodarManutencao(banco: Banco): Promise<ResultadoManutencao> {
  const [linha] = await banco.transacao({}, (tx) => tx.consultar<ResultadoManutencao>(
    'select expurgar_acessibilidade() as acessibilidade, expurgar_meia() as meia, liberar_reservas_vencidas() as reservas'));
  return linha ?? { acessibilidade: 0, meia: 0, reservas: 0 };
}

/** Adaptador da porta VerificadorDependencia para o PostgreSQL. */
import type { VerificadorDependencia } from '../../modules/saude/application/ports.ts';

export function verificadorBanco(banco: { ping(): Promise<void> }): VerificadorDependencia {
  return {
    nome: 'banco',
    async verificar() {
      await banco.ping();
      return 'ok';
    },
  };
}

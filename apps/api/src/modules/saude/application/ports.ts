/**
 * Portas da aplicação (Dependency Inversion): o caso de uso depende destas
 * interfaces; os adaptadores de infraestrutura as implementam.
 */
import type { Estado } from '../domain/saude.ts';

/** Uma dependência externa verificável (banco, provedor de e-mail...). */
export interface VerificadorDependencia {
  readonly nome: string;
  verificar(): Promise<Exclude<Estado, 'falha'>>;
}

/** Relógio injetável: torna o tempo determinístico nos testes. */
export interface Relogio {
  agoraMs(): number;
}

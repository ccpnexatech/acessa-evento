/**
 * Erro de regra dos módulos do organizador (ADR 0029). Um conjunto pequeno de
 * códigos estáveis, traduzido para HTTP num lugar só (shared/http/dominio.ts).
 */
export type CodigoDominio = 'nao_encontrado' | 'sem_permissao' | 'dados_invalidos' | 'conflito' | 'regra';

export class ErroDominio extends Error {
  readonly codigo: CodigoDominio;

  constructor(codigo: CodigoDominio, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDominio';
    this.codigo = codigo;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id vindo da URL: se não é UUID, a coisa não existe (evita erro de tipo no banco). */
export function exigirUuid(valor: string, oQue: string): string {
  if (!UUID.test(valor)) throw new ErroDominio('nao_encontrado', `${oQue} não encontrado.`);
  return valor.toLowerCase();
}

/** Porta de auditoria usada pelos casos de uso do organizador. */
export interface Auditoria {
  registrar(e: { atorId: string | null; acao: string; dados?: Record<string, unknown> }): Promise<void>;
}

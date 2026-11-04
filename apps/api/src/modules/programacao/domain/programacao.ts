/** Modelo da programação do evento (feature 03). Puro, sem I/O. */
export type Recurso = 'libras' | 'legenda' | 'audiodescricao';

export interface Evento {
  readonly id: string;
  readonly slug: string;
  readonly nome: string;
  readonly inicio: string;
  readonly fim: string;
  readonly local: string;
  readonly fuso: string;
}

export interface Atividade {
  readonly id: string;
  readonly titulo: string;
  readonly resumo: string | null;
  readonly inicio: string;
  readonly fim: string;
  readonly recursos: readonly Recurso[];
  readonly sala: { readonly nome: string; readonly local: string; readonly acessibilidade: string | null } | null;
  readonly palestrantes: readonly { readonly nome: string; readonly cargo: string | null }[];
}

export type CodigoErroProgramacao = 'evento_inexistente' | 'atividade_inexistente';

export class ErroProgramacao extends Error {
  readonly codigo: CodigoErroProgramacao;

  constructor(codigo: CodigoErroProgramacao, mensagem: string) {
    super(mensagem);
    this.name = 'ErroProgramacao';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarIdAtividade(id: string): string {
  if (!UUID.test(id)) throw new ErroProgramacao('atividade_inexistente', 'Esta palestra não existe mais.');
  return id.toLowerCase();
}

export function validarSlug(slug: string): string {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) throw new ErroProgramacao('evento_inexistente', 'Evento não encontrado.');
  return slug;
}

/** Tradução única de ErroDominio para HTTP, usada pelas rotas do organizador. */
import { ErroDominio } from '../dominio/erro.ts';
import type { CodigoDominio } from '../dominio/erro.ts';
import { ErroHttp } from './tipos.ts';
import type { Manipulador, Requisicao, Resposta } from './tipos.ts';

const STATUS: Readonly<Record<CodigoDominio, number>> = {
  nao_encontrado: 404,
  sem_permissao: 403,
  dados_invalidos: 422,
  conflito: 409,
  regra: 409,
};

export function traduzirDominio(m: (req: Requisicao) => Promise<Resposta>): Manipulador {
  return async (req) => {
    try {
      return await m(req);
    } catch (erro) {
      if (erro instanceof ErroDominio) throw new ErroHttp(STATUS[erro.codigo], erro.codigo, erro.message);
      throw erro;
    }
  };
}

/** Dados da organização nunca vão para cache compartilhado. */
export const PRIVADO = { 'cache-control': 'private, no-store' } as const;

export const param = (req: Requisicao, nome: string): string => req.parametros[nome] ?? '';

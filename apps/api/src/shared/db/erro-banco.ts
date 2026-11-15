/**
 * Traduz erros do PostgreSQL para ErroDominio (ADR 0029). O banco é a
 * autoridade de permissão (RLS) e de regra (funções e restrições); aqui a
 * resposta dele vira um código que a tela sabe tratar.
 */
import { ErroDominio } from '../dominio/erro.ts';

interface ErroPg {
  readonly code?: string;
  readonly message?: string;
  readonly constraint?: string;
}

const frase = (texto: string): string => {
  const t = texto.trim();
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}`;
};

/** Mensagens para restrições conhecidas; o resto recebe uma frase genérica. */
export type MensagensDeRestricao = Readonly<Record<string, string>>;

export function traduzirErroDeBanco(erro: unknown, mensagens: MensagensDeRestricao = {}): unknown {
  const e = erro as ErroPg | null;
  if (!e || typeof e.code !== 'string') return erro;
  const conhecida = e.constraint ? mensagens[e.constraint] : undefined;
  const texto = e.message ?? '';
  switch (e.code) {
    case '42501': // RLS, privilégio de coluna ou "raise" das funções
      return new ErroDominio('sem_permissao', /row-level security|permission denied/.test(texto)
        ? 'Você não tem permissão para fazer isso.' : frase(texto));
    case '23505':
      return new ErroDominio('conflito', conhecida ?? 'Já existe um registro com esses dados.');
    case '23503':
      // "update or delete on table": alguém ainda aponta para a linha. O contrário é apontar para o que não existe.
      return /^update or delete on table/.test(texto)
        ? new ErroDominio('conflito', conhecida ?? 'Não dá para apagar: há outros registros ligados a este.')
        : new ErroDominio('dados_invalidos', conhecida ?? 'Um dos itens escolhidos não existe neste evento.');
    case '23514': // check de tabela (com nome) ou "raise" de função (sem nome)
      return e.constraint
        ? new ErroDominio('dados_invalidos', conhecida ?? 'Confira os dados: algum valor não é aceito.')
        : new ErroDominio('regra', frase(texto));
    case '23502':
    case '22P02':
    case '22001':
    case '22003':
    case '22007':
    case '22008':
      return new ErroDominio('dados_invalidos', conhecida ?? 'Confira os dados: algum valor não é aceito.');
    default:
      return erro;
  }
}

/** Envolve uma operação de repositório traduzindo o erro do banco. */
export async function comErroDeBanco<T>(trabalho: () => Promise<T>, mensagens: MensagensDeRestricao = {}): Promise<T> {
  try {
    return await trabalho();
  } catch (erro) {
    throw traduzirErroDeBanco(erro, mensagens);
  }
}

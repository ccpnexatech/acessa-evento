/**
 * Acesso ao PostgreSQL. Toda leitura ou escrita de dado de negócio passa
 * por `transacao`, que define quem é a pessoa e qual o evento para as
 * políticas de RLS (ADR 0002). Sem contexto, as políticas não liberam nada.
 */
import pg from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';

export interface ContextoAcesso {
  readonly pessoaId?: string;
  readonly eventoId?: string;
}

/** Porta mínima que os repositórios recebem: só consulta parametrizada. */
export interface Executor {
  consultar<L extends QueryResultRow>(sql: string, parametros?: readonly unknown[]): Promise<L[]>;
}

export interface OpcoesBanco {
  readonly url: string;
  readonly maxConexoes?: number;
  /** Papel assumido em cada transação (testes conectam como dono e descem para app_api). */
  readonly papel?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Banco {
  readonly #pool: pg.Pool;
  readonly #papel: string | undefined;

  constructor(opcoes: OpcoesBanco) {
    this.#pool = new pg.Pool({
      connectionString: opcoes.url,
      max: opcoes.maxConexoes ?? 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      application_name: 'acessa-evento-api',
    });
    if (opcoes.papel !== undefined && !/^[a-z_][a-z0-9_]*$/.test(opcoes.papel)) throw new Error('Nome de papel inválido.');
    this.#papel = opcoes.papel;
  }

  async transacao<T>(contexto: ContextoAcesso, trabalho: (tx: Executor) => Promise<T>): Promise<T> {
    for (const id of [contexto.pessoaId, contexto.eventoId]) {
      if (id !== undefined && !UUID.test(id)) throw new Error('Contexto de acesso com id inválido.');
    }
    const cliente = await this.#pool.connect();
    try {
      await cliente.query('begin');
      if (this.#papel) await cliente.query(`set local role ${this.#papel}`);
      await cliente.query("select set_config('app.pessoa_id', $1, true), set_config('app.evento_id', $2, true)", [
        contexto.pessoaId ?? '',
        contexto.eventoId ?? '',
      ]);
      const resultado = await trabalho(executor(cliente));
      await cliente.query('commit');
      return resultado;
    } catch (erro) {
      await cliente.query('rollback').catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  /** Para a /saude: confirma que o banco responde. */
  async ping(): Promise<void> {
    await this.#pool.query('select 1');
  }

  async fechar(): Promise<void> {
    await this.#pool.end();
  }
}

function executor(cliente: PoolClient): Executor {
  return {
    async consultar<L extends QueryResultRow>(sql: string, parametros: readonly unknown[] = []): Promise<L[]> {
      const r = await cliente.query<L>(sql, [...parametros]);
      return r.rows;
    },
  };
}

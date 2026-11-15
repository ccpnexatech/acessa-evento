/**
 * Banco isolado por arquivo de teste: cria um database novo no PostgreSQL
 * de DATABASE_URL_TESTE (scripts/banco-teste.ts sobe um se precisar),
 * aplica as migrações e apaga tudo no fim.
 */
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lerMigracoes, migrar } from '../../src/shared/db/migrador.ts';
import type { Migracao } from '../../src/shared/db/migrador.ts';

const TRAVA_TESTES = 4_206_001;

export const PASTA_MIGRACOES = fileURLToPath(new URL('../../db/migracoes', import.meta.url));

export interface BancoDeTeste {
  /** URL do database novo, com o superusuário de teste (dono do esquema). */
  readonly url: string;
  /** Cliente como dono: monta dados sem passar pela RLS. */
  readonly dono: pg.Client;
  apagar(): Promise<void>;
}

/**
 * Aplica migrações num banco criado com `migrar: false`, segurando a mesma trava
 * da criação. Sem ela, o teste que migra "em duas etapas" disputaria o papel
 * app_api (que é do cluster) com outro arquivo de teste criando o seu banco.
 */
export async function migrarComTrava(cliente: pg.Client, migracoes: readonly Migracao[]): Promise<void> {
  const base = process.env['DATABASE_URL_TESTE'];
  if (!base) throw new Error('DATABASE_URL_TESTE ausente.');
  const admin = new pg.Client({ connectionString: base, connectionTimeoutMillis: 5_000 });
  await admin.connect();
  try {
    await admin.query('select pg_advisory_lock($1)', [TRAVA_TESTES]);
    await migrar(cliente, migracoes);
  } finally {
    await admin.end();
  }
}

export async function criarBancoDeTeste(opcoes: { migrar?: boolean } = {}): Promise<BancoDeTeste> {
  const base = process.env['DATABASE_URL_TESTE'];
  if (!base) throw new Error('DATABASE_URL_TESTE ausente. Rode pelo npm run e2e (scripts/banco-teste.ts).');
  const nome = `teste_${randomBytes(6).toString('hex')}`;
  const url = new URL(base);
  url.pathname = `/${nome}`;
  const dono = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });

  // Papéis (app_api) são do cluster inteiro: arquivos de teste em paralelo
  // migrando ao mesmo tempo disputariam o create role. Serializa pelo banco base.
  const admin = new pg.Client({ connectionString: base, connectionTimeoutMillis: 5_000 });
  await admin.connect();
  try {
    await admin.query('select pg_advisory_lock($1)', [TRAVA_TESTES]);
    await admin.query(`create database ${nome}`);
    await dono.connect();
    if (opcoes.migrar !== false) await migrar(dono, lerMigracoes(PASTA_MIGRACOES));
  } catch (erro) {
    // Sem isto, uma falha deixaria a conexão aberta e o processo de teste pendurado.
    await dono.end().catch(() => undefined);
    await admin.query(`drop database if exists ${nome} with (force)`).catch(() => undefined);
    throw erro;
  } finally {
    await admin.end(); // encerrar a sessão libera a trava
  }

  return {
    url: url.toString(),
    dono,
    async apagar() {
      await dono.end();
      const a = new pg.Client({ connectionString: base, connectionTimeoutMillis: 5_000 });
      await a.connect();
      // O pool da API dá "fechado" assim que manda encerrar as conexões, antes de os soquetes
      // fecharem. Derrubar o banco à força nesse intervalo mata uma conexão viva, e o erro dela
      // chega sem dono e falha o arquivo de teste. Espera as conexões saírem antes de derrubar.
      for (let tentativa = 0; tentativa < 100; tentativa++) {
        const { rows } = await a.query<{ n: number }>('select count(*)::int as n from pg_stat_activity where datname = $1', [nome]);
        if ((rows[0]?.n ?? 0) === 0) break;
        await new Promise((ok) => setTimeout(ok, 20));
      }
      await a.query(`drop database if exists ${nome} with (force)`);
      await a.end();
    },
  };
}

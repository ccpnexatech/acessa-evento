/**
 * Banco isolado por arquivo de teste: cria um database novo no PostgreSQL
 * de DATABASE_URL_TESTE (scripts/banco-teste.ts sobe um se precisar),
 * aplica as migrações e apaga tudo no fim.
 */
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lerMigracoes, migrar } from '../../src/shared/db/migrador.ts';

export const PASTA_MIGRACOES = fileURLToPath(new URL('../../db/migracoes', import.meta.url));

export interface BancoDeTeste {
  /** URL do database novo, com o superusuário de teste (dono do esquema). */
  readonly url: string;
  /** Cliente como dono: monta dados sem passar pela RLS. */
  readonly dono: pg.Client;
  apagar(): Promise<void>;
}

export async function criarBancoDeTeste(opcoes: { migrar?: boolean } = {}): Promise<BancoDeTeste> {
  const base = process.env['DATABASE_URL_TESTE'];
  if (!base) throw new Error('DATABASE_URL_TESTE ausente. Rode pelo npm run e2e (scripts/banco-teste.ts).');
  const nome = `teste_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: base, connectionTimeoutMillis: 5_000 });
  await admin.connect();
  await admin.query(`create database ${nome}`);
  await admin.end();

  const url = new URL(base);
  url.pathname = `/${nome}`;
  const dono = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });
  await dono.connect();
  if (opcoes.migrar !== false) await migrar(dono, lerMigracoes(PASTA_MIGRACOES));

  return {
    url: url.toString(),
    dono,
    async apagar() {
      await dono.end();
      const a = new pg.Client({ connectionString: base, connectionTimeoutMillis: 5_000 });
      await a.connect();
      await a.query(`drop database if exists ${nome} with (force)`);
      await a.end();
    },
  };
}

/**
 * CLI: aplica as migrações pendentes.
 * Uso: DATABASE_URL_MIGRACAO=postgres://dono@host/banco node src/main/migrar.ts
 * Roda com o usuário dono do esquema, nunca com o usuário da API.
 */
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { LoggerJson } from '../shared/logger.ts';
import { lerMigracoes, migrar } from '../shared/db/migrador.ts';

const logger = new LoggerJson((linha) => process.stdout.write(linha));
const url = process.env['DATABASE_URL_MIGRACAO'];
if (!url) {
  logger.log('error', 'migracao_sem_url', { dica: 'Defina DATABASE_URL_MIGRACAO com o usuário dono do esquema.' });
  process.exit(1);
}

const pasta = fileURLToPath(new URL('../../db/migracoes', import.meta.url));
const cliente = new pg.Client({ connectionString: url });
try {
  await cliente.connect();
  const r = await migrar(cliente, lerMigracoes(pasta));
  logger.log('info', 'migracao_concluida', { aplicadas: r.aplicadas, jaAplicadas: r.jaAplicadas });
} catch (erro) {
  logger.log('error', 'migracao_falhou', { erro: (erro as Error).message });
  process.exitCode = 1;
} finally {
  await cliente.end();
}

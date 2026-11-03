/** CLI: aplica as sementes. Uso: DATABASE_URL_MIGRACAO=... node src/main/semear.ts */
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { LoggerJson } from '../shared/logger.ts';
import { semear } from '../shared/db/semeador.ts';

const logger = new LoggerJson((linha) => process.stdout.write(linha));
const url = process.env['DATABASE_URL_MIGRACAO'];
if (!url) {
  logger.log('error', 'semente_sem_url', { dica: 'Defina DATABASE_URL_MIGRACAO.' });
  process.exit(1);
}
const cliente = new pg.Client({ connectionString: url });
try {
  await cliente.connect();
  const arquivos = await semear(cliente, fileURLToPath(new URL('../../db/sementes', import.meta.url)));
  logger.log('info', 'sementes_aplicadas', { arquivos });
} catch (erro) {
  logger.log('error', 'sementes_falharam', { erro: (erro as Error).message });
  process.exitCode = 1;
} finally {
  await cliente.end();
}

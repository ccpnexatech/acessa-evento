/** Ponto de entrada: lê o ambiente, sobe o servidor e encerra com elegância. */
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { LoggerJson } from '../shared/logger.ts';
import { Banco } from '../shared/db/banco.ts';
import { verificadorBanco } from '../shared/db/verificador-banco.ts';
import { lerConfig } from './config.ts';
import { criarApp } from './app.ts';

const logger = new LoggerJson((linha) => process.stdout.write(linha));

let config;
try {
  config = lerConfig(process.env);
} catch (erro) {
  logger.log('error', 'configuracao_invalida', { erro: (erro as Error).message });
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string };
const banco = config.databaseUrl ? new Banco({ url: config.databaseUrl }) : undefined;
const servidor = criarApp({
  config,
  logger,
  relogio: { agoraMs: () => Date.now() },
  versao: version ?? '0.0.0',
  verificadores: banco ? [verificadorBanco(banco)] : [],
});

servidor.listen(config.porta, () => {
  const { port } = servidor.address() as AddressInfo;
  logger.log('info', 'ouvindo', { porta: port, ambiente: config.ambiente });
});

const encerrar = (sinal: string): void => {
  logger.log('info', 'encerrando', { sinal });
  servidor.close(() => {
    void (banco?.fechar() ?? Promise.resolve()).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));

/** Ponto de entrada: lê o ambiente, sobe o servidor e encerra com elegância. */
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { LoggerJson } from '../shared/logger.ts';
import { relatorNulo, relatorSentry } from '../shared/erros/relator.ts';
import { Banco } from '../shared/db/banco.ts';
import { lerConfig } from './config.ts';
import type { ConfigBanco } from './config.ts';
import { assinadorQr, criarApp, dependenciasAssistente, dependenciasConta, dependenciasCredenciamento, dependenciasInscricao, dependenciasProgramacao, verificadoresPadrao } from './app.ts';

const logger = new LoggerJson((linha) => process.stdout.write(linha));

let config;
try {
  config = lerConfig(process.env);
} catch (erro) {
  logger.log('error', 'configuracao_invalida', { erro: (erro as Error).message });
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string };
const versao = version ?? '0.0.0';
const relator = config.sentryDsn
  ? relatorSentry({ dsn: config.sentryDsn, ambiente: config.ambiente, versao, plataforma: 'node', aoFalhar: (motivo) => logger.log('warn', 'sentry_falhou', { motivo }) })
  : relatorNulo;
// Erro fora de uma requisição também chega ao Sentry antes de o processo seguir ou cair.
process.on('unhandledRejection', (erro) => {
  logger.log('error', 'promessa_sem_tratamento', { erro: erro instanceof Error ? erro.stack : String(erro) });
  relator.capturar(erro, { etiquetas: { origem: 'unhandledRejection' } });
});

const banco = config.banco ? new Banco({ url: config.banco.url }) : undefined;
const servidor = criarApp({
  config,
  logger,
  relator,
  relogio: { agoraMs: () => Date.now() },
  versao,
  verificadores: verificadoresPadrao(banco),
  ...(banco && config.banco ? modulos(banco, config.banco) : {}),
});

function modulos(b: Banco, c: ConfigBanco) {
  const conta = dependenciasConta(b, c, logger);
  const assinador = assinadorQr(c, logger);
  return {
    conta,
    programacao: dependenciasProgramacao(b),
    inscricao: dependenciasInscricao(b, conta, c, logger, assinador),
    credenciamento: dependenciasCredenciamento(b, conta, assinador),
    assistente: dependenciasAssistente(b),
  };
}

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

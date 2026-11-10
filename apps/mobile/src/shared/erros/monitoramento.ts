/**
 * Liga o relator de erros ao app: erros de JavaScript não tratados vão ao
 * Sentry (se houver EXPO_PUBLIC_SENTRY_DSN) e seguem para o tratador padrão.
 */
import { lerDsn, relatorNulo, relatorSentry } from './relator';
import type { RelatorErros } from './relator';

interface ErrorUtilsGlobal {
  getGlobalHandler(): (erro: unknown, fatal?: boolean) => void;
  setGlobalHandler(f: (erro: unknown, fatal?: boolean) => void): void;
}

let relatorAtual: RelatorErros = relatorNulo;

export function relator(): RelatorErros {
  return relatorAtual;
}

export function iniciarMonitoramento(dsnTexto: string | undefined, versao: string, utils: ErrorUtilsGlobal | undefined = (globalThis as { ErrorUtils?: ErrorUtilsGlobal }).ErrorUtils): RelatorErros {
  const dsn = dsnTexto ? lerDsn(dsnTexto) : null;
  relatorAtual = dsn ? relatorSentry({ dsn, ambiente: __DEV__ ? 'desenvolvimento' : 'producao', versao, plataforma: 'javascript' }) : relatorNulo;
  if (dsn && utils) {
    const anterior = utils.getGlobalHandler();
    utils.setGlobalHandler((erro, fatal) => {
      relatorAtual.capturar(erro, { etiquetas: { fatal: String(Boolean(fatal)) } });
      anterior(erro, fatal);
    });
  }
  return relatorAtual;
}

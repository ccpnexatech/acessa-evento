import { iniciarMonitoramento, relator } from './monitoramento';
import { relatorNulo } from './relator';

describe('monitoramento', () => {
  it('sem DSN não envia nada e não troca o tratador', () => {
    const utils = { getGlobalHandler: jest.fn(), setGlobalHandler: jest.fn() };
    expect(iniciarMonitoramento(undefined, '1.0.0', utils)).toBe(relatorNulo);
    expect(utils.setGlobalHandler).not.toHaveBeenCalled();
  });

  it('com DSN, erro não tratado vai ao Sentry e segue para o tratador padrão', async () => {
    const enviados: string[] = [];
    const fetchOriginal = global.fetch;
    global.fetch = jest.fn(async (url: string) => {
      enviados.push(url);
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const anterior = jest.fn();
    let tratador: ((e: unknown, f?: boolean) => void) | undefined;
    iniciarMonitoramento('https://k@o1.ingest.sentry.io/9', '1.0.0', { getGlobalHandler: () => anterior, setGlobalHandler: (f) => { tratador = f; } });
    tratador?.(new Error('quebrou'), true);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(enviados).toEqual(['https://o1.ingest.sentry.io/api/9/envelope/']);
    expect(anterior).toHaveBeenCalledWith(expect.any(Error), true);
    expect(relator()).not.toBe(relatorNulo);
    global.fetch = fetchOriginal;
  });
});

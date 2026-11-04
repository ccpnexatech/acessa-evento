/**
 * Configuração do app vinda do ambiente de build.
 * Atenção: o Expo só embute variáveis EXPO_PUBLIC_* lidas como
 * `process.env.EXPO_PUBLIC_NOME` (com ponto). Com colchetes, o valor some
 * no aparelho e o app cai no padrão.
 */
export function normalizarUrlApi(valor: string | undefined): string {
  const url = (valor ?? '').trim().replace(/\/+$/, '');
  return url || 'http://localhost:3333';
}

export const API_URL = normalizarUrlApi(process.env.EXPO_PUBLIC_API_URL);

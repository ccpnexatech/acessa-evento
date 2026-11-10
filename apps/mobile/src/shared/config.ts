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

/** Evento que o app abre (no MVP, um evento por build). */
export const EVENTO_SLUG = (process.env.EXPO_PUBLIC_EVENTO ?? 'cocal-2026').trim();

/** DSN do Sentry; vazio = erros não saem do aparelho (ADR 0024). */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;

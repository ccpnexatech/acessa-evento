/**
 * Regras do acesso sem senha e da conta (feature 01). Puras, sem I/O.
 */
export const VALIDADE_CODIGO_MS = 10 * 60_000;
export const MAX_TENTATIVAS_CODIGO = 5;
export const MAX_PEDIDOS_JANELA = 3;
export const JANELA_PEDIDOS_MS = 10 * 60_000;
export const VALIDADE_SESSAO_MS = 30 * 24 * 60 * 60_000;
/** Versão vigente dos Termos de uso e da Política de privacidade (data de publicação). */
export const VERSAO_TERMOS = '2026-11-03';

export type CodigoErroConta =
  | 'email_invalido'
  | 'muitos_pedidos'
  | 'codigo_invalido'
  | 'codigo_vencido'
  | 'codigo_bloqueado'
  | 'sessao_invalida'
  | 'consentimento_obrigatorio'
  | 'termos_desatualizados'
  | 'nome_invalido'
  | 'conta_inexistente';

/** Erro de regra de negócio com código estável; o adaptador HTTP escolhe o status. */
export class ErroConta extends Error {
  readonly codigo: CodigoErroConta;

  constructor(codigo: CodigoErroConta, mensagem: string) {
    super(mensagem);
    this.name = 'ErroConta';
    this.codigo = codigo;
  }
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@.]{2,}$/;

export function normalizarEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

export function validarEmail(email: unknown): string {
  if (typeof email !== 'string' || !EMAIL.test(normalizarEmail(email))) {
    throw new ErroConta('email_invalido', 'Confira o e-mail. Ele precisa ter @ e um domínio, como nome@exemplo.com.br.');
  }
  return normalizarEmail(email);
}

export function validarCodigo(codigo: unknown): string {
  if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) {
    throw new ErroConta('codigo_invalido', 'Código inválido. Confira os 6 números do e-mail.');
  }
  return codigo.trim();
}

export function validarNomeCracha(nome: unknown): string {
  const limpo = typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : '';
  if (limpo.length < 3 || limpo.length > 60) {
    throw new ErroConta('nome_invalido', 'Escreva o nome do crachá com 3 a 60 letras.');
  }
  return limpo;
}

/** Comparação em tempo constante, para não vazar quantos bytes acertaram. */
export function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferenca === 0;
}

/** Contrato da API de acesso e conta, do ponto de vista do app. */
import type { ClienteApi } from '../../shared/api/cliente';

export interface Entrada {
  readonly token: string;
  readonly expiraEm: string;
  readonly primeiroAcesso: boolean;
}

export interface Conta {
  readonly id: string;
  readonly email: string;
  readonly nomeCracha: string | null;
  readonly primeiroAcessoPendente: boolean;
  readonly versaoTermos: string;
}

export interface ApiAcesso {
  pedirCodigo(email: string): Promise<void>;
  entrar(email: string, codigo: string): Promise<Entrada>;
  obterConta(): Promise<Conta>;
  concluirPrimeiroAcesso(dados: { nomeCracha: string; aceitaTermos: boolean; versaoTermos: string }): Promise<Conta>;
  sair(): Promise<void>;
}

export function apiAcesso(chamar: ClienteApi): ApiAcesso {
  return {
    pedirCodigo: async (email) => {
      await chamar('POST', '/acesso/codigo', { email });
    },
    entrar: (email, codigo) => chamar<Entrada>('POST', '/acesso/entrar', { email, codigo }),
    obterConta: () => chamar<Conta>('GET', '/conta'),
    concluirPrimeiroAcesso: (dados) => chamar<Conta>('PUT', '/conta/primeiro-acesso', dados),
    sair: async () => {
      await chamar('POST', '/acesso/sair');
    },
  };
}

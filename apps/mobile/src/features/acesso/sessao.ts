/**
 * Onde o token de sessão fica guardado. A porta permite trocar o
 * armazenamento (e testar sem o módulo nativo).
 */
import * as SecureStore from 'expo-secure-store';

export interface ArmazenamentoSessao {
  ler(): Promise<string | null>;
  guardar(token: string): Promise<void>;
  apagar(): Promise<void>;
}

const CHAVE = 'acessa-evento.sessao';

/** Keychain no iOS e Keystore no Android: o token nunca fica em texto puro no aparelho. */
export const sessaoSegura: ArmazenamentoSessao = {
  ler: () => SecureStore.getItemAsync(CHAVE),
  guardar: (token) => SecureStore.setItemAsync(CHAVE, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  apagar: () => SecureStore.deleteItemAsync(CHAVE),
};

export function sessaoEmMemoria(inicial: string | null = null): ArmazenamentoSessao & { readonly atual: () => string | null } {
  let token = inicial;
  return {
    atual: () => token,
    ler: async () => token,
    guardar: async (t) => { token = t; },
    apagar: async () => { token = null; },
  };
}

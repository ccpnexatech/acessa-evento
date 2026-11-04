/**
 * Armazenamento local de dados não sensíveis (agenda, favoritos, fila offline).
 * Dados sensíveis, como o token, ficam no SecureStore (features/acesso/sessao.ts).
 */
import { File, Paths } from 'expo-file-system';

export interface Cofre {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, valor: string): Promise<void>;
  apagar(chave: string): Promise<void>;
}

const CHAVE = /^[a-z0-9-]{1,80}$/;
const arquivo = (chave: string): File => {
  if (!CHAVE.test(chave)) throw new Error(`Chave de armazenamento inválida: ${chave}`);
  return new File(Paths.document, `${chave}.json`);
};

/** Um arquivo JSON por chave, na pasta de documentos do app (fica fora de backups de outros apps). */
export const cofreArquivos: Cofre = {
  async ler(chave) {
    const f = arquivo(chave);
    return f.exists ? f.text() : null;
  },
  async gravar(chave, valor) {
    const f = arquivo(chave);
    if (!f.exists) f.create();
    await f.write(valor);
  },
  async apagar(chave) {
    const f = arquivo(chave);
    if (f.exists) f.delete();
  },
};

export function cofreEmMemoria(): Cofre & { readonly conteudo: Map<string, string> } {
  const conteudo = new Map<string, string>();
  return {
    conteudo,
    ler: async (c) => conteudo.get(c) ?? null,
    gravar: async (c, v) => {
      conteudo.set(c, v);
    },
    apagar: async (c) => {
      conteudo.delete(c);
    },
  };
}

/** Lê JSON sem quebrar o app se o arquivo estiver corrompido. */
export async function lerJson<T>(cofre: Cofre, chave: string): Promise<T | null> {
  const texto = await cofre.ler(chave);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    await cofre.apagar(chave);
    return null;
  }
}

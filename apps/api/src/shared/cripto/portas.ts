/**
 * Portas de criptografia de dados pessoais (ADR 0002).
 * Casos de uso dependem destas interfaces; o algoritmo e a origem das
 * chaves (variável de ambiente hoje, KMS amanhã) ficam no adaptador.
 */
export interface Cifrador {
  /** `contexto` amarra o texto cifrado ao seu uso (ex.: "pessoa.email"). */
  cifrar(texto: string, contexto: string): Buffer;
  decifrar(cifrado: Buffer, contexto: string): string;
}

/** Hash determinístico com chave, para buscar por igualdade sem decifrar. */
export interface Indexador {
  indice(valor: string, contexto: string): Buffer;
}

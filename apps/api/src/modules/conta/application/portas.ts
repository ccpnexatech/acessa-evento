/**
 * Portas do módulo conta (Dependency Inversion). Os casos de uso só
 * conhecem estas interfaces; Postgres, e-mail e criptografia são adaptadores.
 */
export interface CodigoAtivo {
  readonly id: string;
  readonly codigoHash: Uint8Array;
  readonly expiraEm: Date;
  readonly tentativas: number;
}

export interface RepositorioCodigos {
  contarDesde(emailHash: Uint8Array, desde: Date): Promise<number>;
  salvar(dados: { emailHash: Uint8Array; codigoHash: Uint8Array; expiraEm: Date }): Promise<void>;
  /** O código mais recente ainda não usado, vencido ou não. */
  ultimoNaoUsado(emailHash: Uint8Array): Promise<CodigoAtivo | null>;
  /** Soma uma tentativa errada e devolve o total. */
  registrarErro(id: string): Promise<number>;
  marcarUsado(id: string): Promise<void>;
}

export interface Pessoa {
  readonly id: string;
  readonly emailCifrado: Uint8Array;
  readonly nomeCracha: string | null;
  readonly criadaEm: Date;
  readonly termosAceitos: readonly string[];
}

export interface RepositorioPessoas {
  idPorEmailHash(emailHash: Uint8Array): Promise<string | null>;
  criar(dados: { id: string; emailCifrado: Uint8Array; emailHash: Uint8Array }): Promise<void>;
  obter(id: string): Promise<Pessoa | null>;
  concluirPrimeiroAcesso(id: string, nomeCracha: string, versaoTermos: string): Promise<void>;
  /** Tudo o que o sistema guarda da pessoa, para a exportação (LGPD). */
  dadosParaExportar(id: string): Promise<Record<string, unknown>>;
  excluir(id: string): Promise<void>;
}

export interface RepositorioSessoes {
  criar(dados: { pessoaId: string; tokenHash: Uint8Array; expiraEm: Date }): Promise<void>;
  validar(tokenHash: Uint8Array): Promise<{ sessaoId: string; pessoaId: string } | null>;
  revogar(pessoaId: string, sessaoId: string): Promise<void>;
}

export interface EnviadorEmail {
  enviarCodigo(email: string, codigo: string): Promise<void>;
}

export interface Auditoria {
  registrar(evento: { atorId: string | null; acao: string; dados?: Record<string, unknown> }): Promise<void>;
}

/** Criptografia de dados pessoais (implementada em shared/cripto). */
export interface Protecao {
  cifrar(texto: string, contexto: string): Uint8Array;
  decifrar(cifrado: Uint8Array, contexto: string): string;
  indice(valor: string, contexto: string): Uint8Array;
}

export interface Aleatorio {
  codigoSeisDigitos(): string;
  /** Token de sessão com pelo menos 256 bits de entropia. */
  token(): string;
  uuid(): string;
}

export interface Relogio {
  agora(): Date;
}

export interface DependenciasConta {
  readonly codigos: RepositorioCodigos;
  readonly pessoas: RepositorioPessoas;
  readonly sessoes: RepositorioSessoes;
  readonly email: EnviadorEmail;
  readonly auditoria: Auditoria;
  readonly protecao: Protecao;
  readonly aleatorio: Aleatorio;
  readonly relogio: Relogio;
}

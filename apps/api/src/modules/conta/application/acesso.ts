/**
 * Casos de uso do acesso sem senha: pedir código, entrar e autenticar.
 * Cadastro = primeiro login (a conta nasce quando o código confere).
 */
import {
  ErroConta,
  JANELA_PEDIDOS_MS,
  MAX_PEDIDOS_JANELA,
  MAX_TENTATIVAS_CODIGO,
  VALIDADE_CODIGO_MS,
  VALIDADE_SESSAO_MS,
  VERSAO_TERMOS,
  iguaisEmTempoConstante,
  validarCodigo,
  validarEmail,
} from '../domain/regras.ts';
import type { DependenciasConta } from './portas.ts';

export const CONTEXTO = {
  email: 'pessoa.email',
  codigo: 'codigo_acesso',
  token: 'sessao.token',
} as const;

const hashDoCodigo = (d: DependenciasConta, email: string, codigo: string): Uint8Array =>
  d.protecao.indice(`${email}|${codigo}`, CONTEXTO.codigo);

export class PedirCodigo {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  /** Responde igual exista ou não a conta, para não revelar quem está cadastrado. */
  async executar(entrada: { email: unknown }): Promise<{ expiraEm: Date }> {
    const email = validarEmail(entrada.email);
    const emailHash = this.#d.protecao.indice(email, CONTEXTO.email);
    const agora = this.#d.relogio.agora();
    const recentes = await this.#d.codigos.contarDesde(emailHash, new Date(agora.getTime() - JANELA_PEDIDOS_MS));
    if (recentes >= MAX_PEDIDOS_JANELA) {
      throw new ErroConta('muitos_pedidos', 'Muitos pedidos de código. Espere alguns minutos e tente de novo.');
    }
    const codigo = this.#d.aleatorio.codigoSeisDigitos();
    const expiraEm = new Date(agora.getTime() + VALIDADE_CODIGO_MS);
    await this.#d.codigos.salvar({ emailHash, codigoHash: hashDoCodigo(this.#d, email, codigo), expiraEm });
    await this.#d.email.enviarCodigo(email, codigo);
    return { expiraEm };
  }
}

export interface ResultadoEntrada {
  readonly token: string;
  readonly expiraEm: Date;
  /** true quando falta confirmar o nome do crachá e aceitar os termos vigentes. */
  readonly primeiroAcesso: boolean;
}

export class Entrar {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  async executar(entrada: { email: unknown; codigo: unknown }): Promise<ResultadoEntrada> {
    const email = validarEmail(entrada.email);
    const codigo = validarCodigo(entrada.codigo);
    const d = this.#d;
    const emailHash = d.protecao.indice(email, CONTEXTO.email);
    const agora = d.relogio.agora();

    const ativo = await d.codigos.ultimoNaoUsado(emailHash);
    if (!ativo || ativo.expiraEm <= agora) {
      throw new ErroConta('codigo_vencido', 'Este código venceu. Toque em "Enviar outro código".');
    }
    if (ativo.tentativas >= MAX_TENTATIVAS_CODIGO) {
      throw new ErroConta('codigo_bloqueado', 'Muitas tentativas. Peça um novo código daqui a 10 minutos.');
    }
    if (!iguaisEmTempoConstante(ativo.codigoHash, hashDoCodigo(d, email, codigo))) {
      const total = await d.codigos.registrarErro(ativo.id);
      if (total >= MAX_TENTATIVAS_CODIGO) {
        await d.auditoria.registrar({ atorId: null, acao: 'acesso.codigo_bloqueado', dados: { tentativas: total } });
        throw new ErroConta('codigo_bloqueado', 'Muitas tentativas. Peça um novo código daqui a 10 minutos.');
      }
      throw new ErroConta('codigo_invalido', 'Código inválido. Confira os 6 números do e-mail.');
    }
    await d.codigos.marcarUsado(ativo.id);

    let pessoaId = await d.pessoas.idPorEmailHash(emailHash);
    if (!pessoaId) {
      pessoaId = d.aleatorio.uuid();
      await d.pessoas.criar({ id: pessoaId, emailCifrado: d.protecao.cifrar(email, CONTEXTO.email), emailHash });
      await d.auditoria.registrar({ atorId: pessoaId, acao: 'conta.criada' });
    }

    const token = d.aleatorio.token();
    const expiraEm = new Date(agora.getTime() + VALIDADE_SESSAO_MS);
    await d.sessoes.criar({ pessoaId, tokenHash: d.protecao.indice(token, CONTEXTO.token), expiraEm });

    const pessoa = await d.pessoas.obter(pessoaId);
    const primeiroAcesso = !pessoa?.nomeCracha || !pessoa.termosAceitos.includes(VERSAO_TERMOS);
    return { token, expiraEm, primeiroAcesso };
  }
}

export interface Sessao {
  readonly pessoaId: string;
  readonly sessaoId: string;
}

export class Autenticar {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  async executar(token: string | undefined): Promise<Sessao> {
    if (!token || token.length < 32 || token.length > 128) {
      throw new ErroConta('sessao_invalida', 'Entre de novo para continuar.');
    }
    const sessao = await this.#d.sessoes.validar(this.#d.protecao.indice(token, CONTEXTO.token));
    if (!sessao) throw new ErroConta('sessao_invalida', 'Entre de novo para continuar.');
    return sessao;
  }
}

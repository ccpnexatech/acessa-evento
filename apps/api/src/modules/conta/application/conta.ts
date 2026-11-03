/**
 * Casos de uso da conta: primeiro acesso, dados da conta, exportação,
 * exclusão e saída. Todos exigem uma sessão já autenticada.
 */
import { ErroConta, VERSAO_TERMOS, validarNomeCracha } from '../domain/regras.ts';
import { CONTEXTO } from './acesso.ts';
import type { Sessao } from './acesso.ts';
import type { DependenciasConta, Pessoa } from './portas.ts';

export interface VisaoConta {
  readonly id: string;
  readonly email: string;
  readonly nomeCracha: string | null;
  readonly primeiroAcessoPendente: boolean;
  readonly versaoTermos: string;
}

async function pessoaDaSessao(d: DependenciasConta, sessao: Sessao): Promise<Pessoa> {
  const pessoa = await d.pessoas.obter(sessao.pessoaId);
  if (!pessoa) throw new ErroConta('conta_inexistente', 'Esta conta não existe mais.');
  return pessoa;
}

const visao = (d: DependenciasConta, p: Pessoa): VisaoConta => ({
  id: p.id,
  email: d.protecao.decifrar(p.emailCifrado, CONTEXTO.email),
  nomeCracha: p.nomeCracha,
  primeiroAcessoPendente: !p.nomeCracha || !p.termosAceitos.includes(VERSAO_TERMOS),
  versaoTermos: VERSAO_TERMOS,
});

export class ObterConta {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  async executar(sessao: Sessao): Promise<VisaoConta> {
    return visao(this.#d, await pessoaDaSessao(this.#d, sessao));
  }
}

export class ConcluirPrimeiroAcesso {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  async executar(sessao: Sessao, entrada: { nomeCracha: unknown; aceitaTermos: unknown; versaoTermos: unknown }): Promise<VisaoConta> {
    const nome = validarNomeCracha(entrada.nomeCracha);
    if (entrada.aceitaTermos !== true) {
      throw new ErroConta('consentimento_obrigatorio', 'Para continuar, aceite os termos.');
    }
    if (entrada.versaoTermos !== VERSAO_TERMOS) {
      throw new ErroConta('termos_desatualizados', 'Os termos mudaram. Leia a versão nova antes de aceitar.');
    }
    await pessoaDaSessao(this.#d, sessao);
    await this.#d.pessoas.concluirPrimeiroAcesso(sessao.pessoaId, nome, VERSAO_TERMOS);
    await this.#d.auditoria.registrar({ atorId: sessao.pessoaId, acao: 'conta.termos_aceitos', dados: { versao: VERSAO_TERMOS } });
    return visao(this.#d, await pessoaDaSessao(this.#d, sessao));
  }
}

export class ExportarConta {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  async executar(sessao: Sessao): Promise<Record<string, unknown>> {
    const pessoa = await pessoaDaSessao(this.#d, sessao);
    const dados = await this.#d.pessoas.dadosParaExportar(sessao.pessoaId);
    await this.#d.auditoria.registrar({ atorId: sessao.pessoaId, acao: 'conta.exportada' });
    return {
      geradoEm: this.#d.relogio.agora().toISOString(),
      conta: visao(this.#d, pessoa),
      ...dados,
    };
  }
}

export class ExcluirConta {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  /** Apaga a pessoa e, em cascata, sessões, consentimentos e vínculos. A auditoria guarda só o id. */
  async executar(sessao: Sessao): Promise<void> {
    await pessoaDaSessao(this.#d, sessao);
    await this.#d.auditoria.registrar({ atorId: sessao.pessoaId, acao: 'conta.excluida' });
    await this.#d.pessoas.excluir(sessao.pessoaId);
  }
}

export class Sair {
  readonly #d: DependenciasConta;
  constructor(d: DependenciasConta) {
    this.#d = d;
  }

  async executar(sessao: Sessao): Promise<void> {
    await this.#d.sessoes.revogar(sessao.pessoaId, sessao.sessaoId);
  }
}

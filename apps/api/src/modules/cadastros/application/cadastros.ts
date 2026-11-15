/**
 * Caso de uso único dos cadastros simples (ADR 0029): valida pelo catálogo,
 * delega ao repositório (onde a RLS decide a permissão) e audita a escrita.
 */
import { ErroDominio, exigirUuid } from '../../../shared/dominio/erro.ts';
import type { Auditoria } from '../../../shared/dominio/erro.ts';
import { validarCampos } from '../domain/campos.ts';
import type { Valores } from '../domain/campos.ts';
import { cadastro } from '../domain/catalogo.ts';
import type { NomeCadastro } from '../domain/catalogo.ts';

export type Registro = Readonly<Record<string, unknown>> & { readonly id: string };

export interface RepositorioCadastros {
  /** Id do evento (pelo slug) ou da organização, se a pessoa consegue vê-lo. */
  escopo(pessoaId: string, tipo: 'evento' | 'organizacao', referencia: string): Promise<string | null>;
  listar(pessoaId: string, nome: NomeCadastro, escopoId: string): Promise<Registro[]>;
  criar(pessoaId: string, nome: NomeCadastro, escopoId: string, valores: Valores): Promise<Registro>;
  alterar(pessoaId: string, nome: NomeCadastro, escopoId: string, id: string, valores: Valores): Promise<Registro | null>;
  apagar(pessoaId: string, nome: NomeCadastro, escopoId: string, id: string): Promise<boolean>;
}

export interface DependenciasCadastros {
  readonly repositorio: RepositorioCadastros;
  readonly auditoria: Auditoria;
}

const SEM_ACESSO = 'Não encontrado, ou você não tem permissão para alterar.';

export class CadastrosServico {
  readonly #d: DependenciasCadastros;

  constructor(d: DependenciasCadastros) {
    this.#d = d;
  }

  async #escopo(pessoaId: string, nome: NomeCadastro, referencia: string): Promise<string> {
    const { escopo } = cadastro(nome);
    const ref = escopo === 'organizacao' ? exigirUuid(referencia, 'Organização') : referencia;
    const id = await this.#d.repositorio.escopo(pessoaId, escopo, ref);
    if (!id) throw new ErroDominio('nao_encontrado', escopo === 'evento' ? 'Evento não encontrado.' : 'Organização não encontrada.');
    return id;
  }

  #permite(nome: NomeCadastro, operacao: 'alterar' | 'apagar'): void {
    if (cadastro(nome).sem?.includes(operacao)) throw new ErroDominio('regra', 'Esta operação não existe para este cadastro.');
  }

  async listar(pessoaId: string, nome: NomeCadastro, referencia: string): Promise<Registro[]> {
    return this.#d.repositorio.listar(pessoaId, nome, await this.#escopo(pessoaId, nome, referencia));
  }

  async criar(pessoaId: string, nome: NomeCadastro, referencia: string, corpo: unknown): Promise<Registro> {
    const valores = validarCampos(cadastro(nome).campos, corpo, 'criar');
    const escopoId = await this.#escopo(pessoaId, nome, referencia);
    const registro = await this.#d.repositorio.criar(pessoaId, nome, escopoId, valores);
    await this.#auditar(pessoaId, nome, 'criar', escopoId, registro.id);
    return registro;
  }

  async alterar(pessoaId: string, nome: NomeCadastro, referencia: string, id: string, corpo: unknown): Promise<Registro> {
    this.#permite(nome, 'alterar');
    const valores = validarCampos(cadastro(nome).campos, corpo, 'alterar');
    const escopoId = await this.#escopo(pessoaId, nome, referencia);
    const registro = await this.#d.repositorio.alterar(pessoaId, nome, escopoId, exigirUuid(id, 'Registro'), valores);
    if (!registro) throw new ErroDominio('nao_encontrado', SEM_ACESSO);
    await this.#auditar(pessoaId, nome, 'alterar', escopoId, registro.id, Object.keys(valores));
    return registro;
  }

  async apagar(pessoaId: string, nome: NomeCadastro, referencia: string, id: string): Promise<void> {
    this.#permite(nome, 'apagar');
    const escopoId = await this.#escopo(pessoaId, nome, referencia);
    const idOk = exigirUuid(id, 'Registro');
    if (!(await this.#d.repositorio.apagar(pessoaId, nome, escopoId, idOk))) throw new ErroDominio('nao_encontrado', SEM_ACESSO);
    await this.#auditar(pessoaId, nome, 'apagar', escopoId, idOk);
  }

  #auditar(atorId: string, nome: NomeCadastro, operacao: string, escopoId: string, id: string, campos?: string[]): Promise<void> {
    // A auditoria guarda o que mudou, nunca o conteúdo: aviso e contrato podem ter dado pessoal.
    return this.#d.auditoria.registrar({
      atorId,
      acao: `cadastro.${nome.replaceAll('-', '_')}.${operacao}`,
      dados: { [cadastro(nome).escopo === 'evento' ? 'eventoId' : 'organizacaoId']: escopoId, id, ...(campos ? { campos } : {}) },
    });
  }
}

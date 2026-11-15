/** Casos de uso da feira, do portal do expositor e dos contratos (feature 10). As regras de negócio que não podem falhar estão no banco (ADR 0028). */
import { ErroDominio, exigirUuid } from '../../../shared/dominio/erro.ts';
import type { Auditoria } from '../../../shared/dominio/erro.ts';
import type { Valores } from '../../cadastros/domain/campos.ts';
import { textoDoConvite, validarEmailDeConvite } from '../../organizacao/domain/organizacao.ts';
import {
  proximoNivel, validarAlteracaoDeContrato, validarAnalise, validarMontagem, validarNovoContrato, validarPerfil, validarQuantidade,
  validarReferencia, validarSituacaoDoPedido,
} from '../domain/feira.ts';
import type { DadosMontagem, NovoContrato } from '../domain/feira.ts';

export type Linha = Readonly<Record<string, unknown>>;
export interface EventoFeira { readonly id: string; readonly slug: string; readonly nome: string; readonly organizacaoId: string; readonly organizacao: string }
export interface Participacao {
  readonly id: string; readonly parceiro: string; readonly categoria: string; readonly situacao: string; readonly papel: string | null;
  readonly evento: EventoFeira;
}
export interface Resumo { readonly estandes: number; readonly areaM2: number; readonly investimentoCentavos: number; readonly nivel: string | null; readonly credenciaisDireito: number }

export interface RepositorioFeira {
  evento(pessoaId: string, slug: string): Promise<EventoFeira | null>;
  parceirosDoEvento(pessoaId: string, eventoId: string): Promise<Linha[]>;
  /** Participações em que a pessoa é responsável ou equipe. */
  minhasParticipacoes(pessoaId: string): Promise<Participacao[]>;
  /** Uma participação, se a pessoa a enxerga (membro do parceiro ou organização). */
  participacao(pessoaId: string, id: string): Promise<Participacao | null>;
  resumo(pessoaId: string, id: string): Promise<Resumo>;
  niveis(pessoaId: string, eventoId: string): Promise<{ nome: string; investimentoMinimoCentavos: number; beneficios: string[] }[]>;
  estandesDe(pessoaId: string, id: string): Promise<Linha[]>;
  perfil(pessoaId: string, id: string): Promise<Linha | null>;
  pedidos(pessoaId: string, id: string): Promise<Linha[]>;
  montagem(pessoaId: string, id: string): Promise<Linha | null>;
  equipe(pessoaId: string, id: string): Promise<Linha[]>;
  contratosDe(pessoaId: string, id: string): Promise<Linha[]>;
  reservar(pessoaId: string, estandeId: string, id: string): Promise<boolean>;
  liberar(pessoaId: string, estandeId: string): Promise<boolean>;
  salvarPerfil(pessoaId: string, p: Participacao, valores: Valores): Promise<void>;
  pedirServico(pessoaId: string, p: Participacao, servicoId: string, quantidade: number): Promise<Linha>;
  cancelarPedido(pessoaId: string, id: string, servicoId: string): Promise<boolean>;
  situacaoDoPedido(pessoaId: string, eventoId: string, pedidoId: string, situacao: string): Promise<boolean>;
  salvarMontagem(pessoaId: string, p: Participacao, dados: DadosMontagem): Promise<Linha>;
  analisarMontagem(pessoaId: string, id: string, aprovar: boolean, observacao: string | null): Promise<boolean>;
  convidar(pessoaId: string, p: Participacao, emailCifrado: Uint8Array, emailHash: Uint8Array, papel: string): Promise<{ id: string; expiraEm: string }>;
  emitirCredencial(pessoaId: string, id: string, alvoId: string): Promise<string>;
  expositores(pessoaId: string | null, slug: string): Promise<{ expositores: Linha[]; plantas: Linha[]; estandes: Linha[]; segmentos: Linha[] } | null>;
  contratos(pessoaId: string, eventoId: string): Promise<Linha[]>;
  criarContrato(pessoaId: string, eventoId: string, c: NovoContrato): Promise<{ id: string } | 'modelo_inexistente'>;
  alterarContrato(pessoaId: string, eventoId: string, id: string, valores: Valores): Promise<boolean>;
  enviarContrato(pessoaId: string, id: string): Promise<boolean>;
  cancelarContrato(pessoaId: string, id: string): Promise<boolean>;
  assinarContrato(pessoaId: string, id: string, referencia: string | null): Promise<boolean>;
  meusContratos(pessoaId: string): Promise<Linha[]>;
}

export interface DependenciasFeira {
  readonly repositorio: RepositorioFeira;
  readonly auditoria: Auditoria;
  readonly protecao: { cifrar(texto: string, contexto: string): Uint8Array; indice(valor: string, contexto: string): Uint8Array };
  readonly enviarEmail: (para: string, assunto: string, texto: string) => Promise<void>;
}

const CONTEXTO_EMAIL = 'pessoa.email';

export class FeiraServico {
  readonly #d: DependenciasFeira;

  constructor(d: DependenciasFeira) {
    this.#d = d;
  }

  async #evento(pessoaId: string, slug: string): Promise<EventoFeira> {
    const evento = await this.#d.repositorio.evento(pessoaId, slug);
    if (!evento) throw new ErroDominio('nao_encontrado', 'Evento não encontrado.');
    return evento;
  }

  async #participacao(pessoaId: string, id: string): Promise<Participacao> {
    const p = await this.#d.repositorio.participacao(pessoaId, exigirUuid(id, 'Parceiro'));
    if (!p) throw new ErroDominio('nao_encontrado', 'Parceiro não encontrado.');
    return p;
  }

  #auditar(atorId: string, acao: string, dados: Record<string, unknown>): Promise<void> {
    return this.#d.auditoria.registrar({ atorId, acao, dados });
  }

  // ------------------------------------------------------------ organização

  async feira(pessoaId: string, slug: string) {
    const evento = await this.#evento(pessoaId, slug);
    return { parceiros: await this.#d.repositorio.parceirosDoEvento(pessoaId, evento.id) };
  }

  async analisarMontagem(pessoaId: string, slug: string, participacaoId: string, corpo: unknown): Promise<void> {
    const { aprovar, observacao } = validarAnalise(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const id = exigirUuid(participacaoId, 'Parceiro');
    if (!(await this.#d.repositorio.analisarMontagem(pessoaId, id, aprovar, observacao))) {
      throw new ErroDominio('regra', 'Esta montagem não está em análise, ou você não pode analisá-la.');
    }
    await this.#auditar(pessoaId, 'montagem.analisar', { eventoId: evento.id, parceiroEventoId: id, aprovar });
  }

  async situacaoDoPedido(pessoaId: string, slug: string, pedidoId: string, corpo: unknown): Promise<void> {
    const situacao = validarSituacaoDoPedido(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const id = exigirUuid(pedidoId, 'Pedido');
    if (!(await this.#d.repositorio.situacaoDoPedido(pessoaId, evento.id, id, situacao))) throw new ErroDominio('nao_encontrado', 'Pedido não encontrado.');
    await this.#auditar(pessoaId, 'servico.situacao', { eventoId: evento.id, pedidoId: id, situacao });
  }

  // ----------------------------------------------------------------- portal

  portal(pessoaId: string): Promise<Participacao[]> {
    return this.#d.repositorio.minhasParticipacoes(pessoaId);
  }

  /** Tudo o que o expositor vê do seu espaço: resumo calculado, estandes, marca, serviços, montagem, equipe e contratos. */
  async participacao(pessoaId: string, id: string) {
    const p = await this.#participacao(pessoaId, id);
    const r = this.#d.repositorio;
    const [resumo, niveis, estandes, perfil, pedidos, montagem, equipe, contratos] = await Promise.all([
      r.resumo(pessoaId, p.id), r.niveis(pessoaId, p.evento.id), r.estandesDe(pessoaId, p.id), r.perfil(pessoaId, p.id),
      r.pedidos(pessoaId, p.id), r.montagem(pessoaId, p.id), r.equipe(pessoaId, p.id), r.contratosDe(pessoaId, p.id),
    ]);
    const assinado = contratos.some((c) => c['situacao'] === 'assinado');
    return {
      participacao: p,
      resumo: { ...resumo, proximoNivel: proximoNivel(resumo.investimentoCentavos, niveis) },
      niveis, estandes, perfil, pedidos, montagem, equipe, contratos,
      // O que falta, em ordem: é a lista de "o que fazer agora" do portal.
      pendencias: [
        ...(estandes.length === 0 ? ['Escolha seu estande no mapa.'] : []),
        ...(!perfil ? ['Monte a sua marca no app.'] : []),
        ...(!montagem ? ['Informe como será a montagem.'] : montagem['situacao'] === 'pendente' ? ['Envie o projeto, a ART ou RRT e aceite o termo de responsabilidade.'] : []),
        ...(!assinado ? [contratos.some((c) => c['situacao'] === 'enviado') ? 'Leia e assine o contrato.' : 'Aguarde o contrato da organização.'] : []),
      ],
    };
  }

  async reservar(pessoaId: string, id: string, estandeId: string): Promise<void> {
    const p = await this.#participacao(pessoaId, id);
    const estande = exigirUuid(estandeId, 'Estande');
    if (!(await this.#d.repositorio.reservar(pessoaId, estande, p.id))) {
      throw new ErroDominio('conflito', 'Este estande acabou de ser reservado. Escolha outro.');
    }
    await this.#auditar(pessoaId, 'estande.reservar', { eventoId: p.evento.id, parceiroEventoId: p.id, estandeId: estande });
  }

  async liberar(pessoaId: string, id: string, estandeId: string): Promise<void> {
    const p = await this.#participacao(pessoaId, id);
    const estande = exigirUuid(estandeId, 'Estande');
    if (!(await this.#d.repositorio.liberar(pessoaId, estande))) {
      throw new ErroDominio('regra', 'Este estande não pode ser liberado por você. Estande vendido só a organização libera.');
    }
    await this.#auditar(pessoaId, 'estande.liberar', { eventoId: p.evento.id, parceiroEventoId: p.id, estandeId: estande });
  }

  async salvarPerfil(pessoaId: string, id: string, corpo: unknown): Promise<void> {
    const valores = validarPerfil(corpo);
    const p = await this.#participacao(pessoaId, id);
    await this.#d.repositorio.salvarPerfil(pessoaId, p, valores);
    await this.#auditar(pessoaId, 'perfil_expositor.salvar', { eventoId: p.evento.id, parceiroEventoId: p.id, publicado: valores['publicado'] });
  }

  async pedirServico(pessoaId: string, id: string, servicoId: string, corpo: unknown): Promise<Linha> {
    const quantidade = validarQuantidade(corpo);
    const p = await this.#participacao(pessoaId, id);
    const pedido = await this.#d.repositorio.pedirServico(pessoaId, p, exigirUuid(servicoId, 'Serviço'), quantidade);
    await this.#auditar(pessoaId, 'servico.pedir', { eventoId: p.evento.id, parceiroEventoId: p.id, servicoId, quantidade });
    return pedido;
  }

  async cancelarPedido(pessoaId: string, id: string, servicoId: string): Promise<void> {
    const p = await this.#participacao(pessoaId, id);
    if (!(await this.#d.repositorio.cancelarPedido(pessoaId, p.id, exigirUuid(servicoId, 'Serviço')))) throw new ErroDominio('nao_encontrado', 'Pedido não encontrado.');
    await this.#auditar(pessoaId, 'servico.cancelar', { eventoId: p.evento.id, parceiroEventoId: p.id, servicoId });
  }

  async salvarMontagem(pessoaId: string, id: string, corpo: unknown): Promise<Linha> {
    const dados = validarMontagem(corpo);
    const p = await this.#participacao(pessoaId, id);
    const montagem = await this.#d.repositorio.salvarMontagem(pessoaId, p, dados);
    await this.#auditar(pessoaId, 'montagem.salvar', { eventoId: p.evento.id, parceiroEventoId: p.id, tipo: dados.tipo });
    return montagem;
  }

  /** A organização convida o responsável; o responsável convida a própria equipe (a política do banco confere). */
  async convidar(pessoaId: string, id: string, corpo: unknown): Promise<{ id: string; expiraEm: string }> {
    const x = (corpo ?? {}) as Record<string, unknown>;
    const email = validarEmailDeConvite(x['email']);
    const papel = x['papel'] === 'responsavel' ? 'responsavel' : 'equipe';
    const p = await this.#participacao(pessoaId, id);
    const convite = await this.#d.repositorio.convidar(pessoaId, p, this.#d.protecao.cifrar(email, CONTEXTO_EMAIL), this.#d.protecao.indice(email, CONTEXTO_EMAIL), papel);
    await this.#auditar(pessoaId, 'convite.criar', { eventoId: p.evento.id, parceiroEventoId: p.id, conviteId: convite.id, papeis: [papel] });
    const { assunto, texto } = textoDoConvite({ organizacao: p.evento.organizacao, evento: p.evento.nome, parceiro: p.parceiro, papeis: [papel] });
    await this.#d.enviarEmail(email, assunto, texto).catch(() => undefined);
    return convite;
  }

  async emitirCredencial(pessoaId: string, id: string, corpo: unknown): Promise<{ id: string }> {
    const alvo = exigirUuid(String((corpo as { pessoaId?: unknown } | null)?.pessoaId ?? ''), 'Pessoa');
    const p = await this.#participacao(pessoaId, id);
    const credencialId = await this.#d.repositorio.emitirCredencial(pessoaId, p.id, alvo);
    await this.#auditar(pessoaId, 'credencial.emitir', { eventoId: p.evento.id, parceiroEventoId: p.id, credencialId, categoria: p.categoria });
    return { id: credencialId };
  }

  // ---------------------------------------------------------------- público

  async expositores(pessoaId: string | null, slug: string) {
    const r = await this.#d.repositorio.expositores(pessoaId, slug);
    if (!r) throw new ErroDominio('nao_encontrado', 'Evento não encontrado.');
    return r;
  }

  // -------------------------------------------------------------- contratos

  async contratos(pessoaId: string, slug: string) {
    const evento = await this.#evento(pessoaId, slug);
    return { contratos: await this.#d.repositorio.contratos(pessoaId, evento.id) };
  }

  async criarContrato(pessoaId: string, slug: string, corpo: unknown): Promise<{ id: string }> {
    const dados = validarNovoContrato(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const r = await this.#d.repositorio.criarContrato(pessoaId, evento.id, dados);
    if (r === 'modelo_inexistente') throw new ErroDominio('dados_invalidos', 'Modelo: escolha um modelo da organização.');
    await this.#auditar(pessoaId, 'contrato.criar', { eventoId: evento.id, contratoId: r.id, via: dados.via });
    return r;
  }

  async alterarContrato(pessoaId: string, slug: string, id: string, corpo: unknown): Promise<void> {
    const valores = validarAlteracaoDeContrato(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const contratoId = exigirUuid(id, 'Contrato');
    if (!(await this.#d.repositorio.alterarContrato(pessoaId, evento.id, contratoId, valores))) throw new ErroDominio('nao_encontrado', 'Contrato não encontrado.');
    await this.#auditar(pessoaId, 'contrato.alterar', { eventoId: evento.id, contratoId, campos: Object.keys(valores) });
  }

  async #mudar(pessoaId: string, id: string, acao: 'enviar' | 'cancelar', feito: (contratoId: string) => Promise<boolean>): Promise<void> {
    const contratoId = exigirUuid(id, 'Contrato');
    if (!(await feito(contratoId))) {
      throw new ErroDominio('regra', acao === 'enviar' ? 'Só um rascunho pode ser enviado.' : 'Contrato assinado não pode ser cancelado por aqui.');
    }
    await this.#auditar(pessoaId, `contrato.${acao}`, { contratoId });
  }

  enviarContrato(pessoaId: string, id: string): Promise<void> {
    return this.#mudar(pessoaId, id, 'enviar', (c) => this.#d.repositorio.enviarContrato(pessoaId, c));
  }

  cancelarContrato(pessoaId: string, id: string): Promise<void> {
    return this.#mudar(pessoaId, id, 'cancelar', (c) => this.#d.repositorio.cancelarContrato(pessoaId, c));
  }

  /** Aceite no app por quem contrata (sem protocolo) ou registro da organização (com protocolo). O banco confere quem pode cada um. */
  async assinarContrato(pessoaId: string, id: string, corpo: unknown, comProtocolo: boolean): Promise<void> {
    const referencia = comProtocolo ? validarReferencia(corpo) : null;
    const contratoId = exigirUuid(id, 'Contrato');
    if (!(await this.#d.repositorio.assinarContrato(pessoaId, contratoId, referencia))) {
      throw new ErroDominio('regra', 'Este contrato não está aguardando assinatura.');
    }
    await this.#auditar(pessoaId, 'contrato.assinar', { contratoId, via: comProtocolo ? 'registro' : 'aceite_no_app' });
  }

  async meusContratos(pessoaId: string) {
    return { contratos: await this.#d.repositorio.meusContratos(pessoaId) };
  }
}

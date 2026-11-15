/** Casos de uso de organização, evento, equipe e convite (feature 07). */
import { ErroDominio, exigirUuid } from '../../../shared/dominio/erro.ts';
import type { Auditoria } from '../../../shared/dominio/erro.ts';
import type { Valores } from '../../cadastros/domain/campos.ts';
import {
  DESCRICAO_DOS_PAPEIS, PAPEIS_EVENTO, PAPEIS_ORGANIZACAO, textoDoConvite, validarAlteracaoDeEvento, validarConvite,
  validarMembro, validarNovoEvento, validarOrganizacao,
} from '../domain/organizacao.ts';
import type { DadosMembro, Tema } from '../domain/organizacao.ts';

export interface OrganizacaoResumo { readonly id: string; readonly nome: string; readonly papeis: readonly string[] }
export interface EventoResumo {
  readonly id: string; readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string;
  readonly publicado: boolean; readonly demonstracao: boolean; readonly organizacaoId: string; readonly papeis: readonly string[];
}
export interface EventoDetalhe extends EventoResumo {
  readonly local: string; readonly localId: string | null; readonly descricao: string | null; readonly fuso: string;
  readonly inscricoesAbertas: boolean; readonly recursosOferecidos: readonly string[]; readonly tema: Readonly<Record<string, unknown>>;
  readonly feiraM2PorCredencial: number; readonly organizacao: string;
}
export interface ItemProntidao { readonly item: string; readonly feito: boolean; readonly quantidade: number }
export interface ConvitePendente {
  readonly id: string; readonly organizacao: string; readonly evento: string | null; readonly parceiro: string | null;
  readonly papeis: readonly string[]; readonly expiraEm: string;
}
export interface Membro {
  readonly pessoaId: string; readonly nome: string; readonly papeis: readonly string[];
  readonly cargo: string | null; readonly exibirPublico: boolean;
}
export interface ConviteSalvo {
  readonly id: string; readonly emailCifrado: Uint8Array; readonly papeis: readonly string[]; readonly expiraEm: string;
  readonly situacao: 'aguardando' | 'aceito' | 'cancelado' | 'vencido';
}
export interface NovoConvite {
  readonly organizacaoId: string; readonly eventoId: string | null; readonly parceiroEventoId?: string | null;
  readonly emailCifrado: Uint8Array; readonly emailHash: Uint8Array; readonly papeis: readonly string[];
}

export interface RepositorioOrganizacao {
  organizacoes(pessoaId: string): Promise<OrganizacaoResumo[]>;
  eventos(pessoaId: string): Promise<EventoResumo[]>;
  convitesPendentes(pessoaId: string): Promise<ConvitePendente[]>;
  criarOrganizacao(pessoaId: string, valores: Valores): Promise<string>;
  organizacao(pessoaId: string, id: string): Promise<{ id: string; nome: string } | null>;
  criarEvento(pessoaId: string, organizacaoId: string, valores: Valores): Promise<{ id: string; slug: string }>;
  /** O evento como a equipe vê; nulo se não existe ou a pessoa não o enxerga. */
  evento(pessoaId: string, slug: string): Promise<EventoDetalhe | null>;
  prontidao(pessoaId: string, eventoId: string): Promise<ItemProntidao[]>;
  numeros(pessoaId: string, eventoId: string): Promise<Readonly<Record<string, number>>>;
  alterarEvento(pessoaId: string, eventoId: string, valores: Valores, tema?: Tema): Promise<boolean>;
  equipe(pessoaId: string, eventoId: string): Promise<Membro[]>;
  definirMembro(pessoaId: string, eventoId: string, alvoId: string, dados: DadosMembro): Promise<void>;
  removerMembro(pessoaId: string, eventoId: string, alvoId: string): Promise<boolean>;
  convites(pessoaId: string, eventoId: string): Promise<ConviteSalvo[]>;
  criarConvite(pessoaId: string, convite: NovoConvite): Promise<{ id: string; expiraEm: string }>;
  revogarConvite(pessoaId: string, id: string): Promise<boolean>;
  aceitarConvite(pessoaId: string, id: string): Promise<boolean>;
}

export interface ProtecaoDeEmail {
  cifrar(texto: string, contexto: string): Uint8Array;
  decifrar(cifrado: Uint8Array, contexto: string): string;
  indice(valor: string, contexto: string): Uint8Array;
}

export interface DependenciasOrganizacao {
  readonly repositorio: RepositorioOrganizacao;
  readonly auditoria: Auditoria;
  readonly protecao: ProtecaoDeEmail;
  /** Envio de texto simples; falha de envio não desfaz o convite (ele aparece no app de quem foi convidado). */
  readonly enviarEmail: (para: string, assunto: string, texto: string) => Promise<void>;
}

/** Mesmo contexto de cifra do e-mail da conta: o índice do convite tem de bater com o da pessoa. */
const CONTEXTO_EMAIL = 'pessoa.email';

export class OrganizacaoServico {
  readonly #d: DependenciasOrganizacao;

  constructor(d: DependenciasOrganizacao) {
    this.#d = d;
  }

  /** Ponto de partida do app: o que a pessoa organiza e os convites esperando resposta. */
  async inicio(pessoaId: string) {
    const [organizacoes, eventos, convites] = await Promise.all([
      this.#d.repositorio.organizacoes(pessoaId),
      this.#d.repositorio.eventos(pessoaId),
      this.#d.repositorio.convitesPendentes(pessoaId),
    ]);
    return { organizacoes, eventos, convites };
  }

  async criarOrganizacao(pessoaId: string, corpo: unknown): Promise<{ id: string }> {
    const id = await this.#d.repositorio.criarOrganizacao(pessoaId, validarOrganizacao(corpo));
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'organizacao.criar', dados: { organizacaoId: id } });
    return { id };
  }

  async criarEvento(pessoaId: string, organizacaoId: string, corpo: unknown): Promise<{ id: string; slug: string }> {
    const valores = validarNovoEvento(corpo);
    const evento = await this.#d.repositorio.criarEvento(pessoaId, exigirUuid(organizacaoId, 'Organização'), valores);
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'evento.criar', dados: { eventoId: evento.id, demonstracao: valores['demonstracao'] === true } });
    return evento;
  }

  async #eventoDaEquipe(pessoaId: string, slug: string): Promise<EventoDetalhe> {
    const evento = await this.#d.repositorio.evento(pessoaId, slug);
    if (!evento) throw new ErroDominio('nao_encontrado', 'Evento não encontrado.');
    if (evento.papeis.length === 0) throw new ErroDominio('sem_permissao', 'Você não faz parte da equipe deste evento.');
    return evento;
  }

  /** Início do evento: dados, papéis de quem pergunta, checklist de prontidão e números. */
  async evento(pessoaId: string, slug: string) {
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    const [prontidao, numeros] = await Promise.all([
      this.#d.repositorio.prontidao(pessoaId, evento.id),
      this.#d.repositorio.numeros(pessoaId, evento.id),
    ]);
    return { evento, prontidao, numeros };
  }

  async alterarEvento(pessoaId: string, slug: string, corpo: unknown): Promise<void> {
    const { valores, tema } = validarAlteracaoDeEvento(corpo);
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    if (!(await this.#d.repositorio.alterarEvento(pessoaId, evento.id, valores, tema))) {
      throw new ErroDominio('sem_permissao', 'Só a administração do evento altera estes dados.');
    }
    await this.#d.auditoria.registrar({
      atorId: pessoaId,
      acao: valores['publicado'] === undefined ? 'evento.alterar' : (valores['publicado'] ? 'evento.publicar' : 'evento.despublicar'),
      dados: { eventoId: evento.id, campos: [...Object.keys(valores), ...(tema ? ['tema'] : [])] },
    });
  }

  async equipe(pessoaId: string, slug: string) {
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    const membros = await this.#d.repositorio.equipe(pessoaId, evento.id);
    // Convites só aparecem para quem pode convidar; para os outros a lista vem vazia pela RLS.
    const convites = (await this.#d.repositorio.convites(pessoaId, evento.id)).map((c) => ({
      id: c.id, email: this.#d.protecao.decifrar(c.emailCifrado, CONTEXTO_EMAIL), papeis: c.papeis, expiraEm: c.expiraEm, situacao: c.situacao,
    }));
    return { membros, convites, papeis: PAPEIS_EVENTO.map((p) => ({ papel: p, descricao: DESCRICAO_DOS_PAPEIS[p] })) };
  }

  async definirMembro(pessoaId: string, slug: string, alvoId: string, corpo: unknown): Promise<void> {
    const dados = validarMembro(corpo);
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    const alvo = exigirUuid(alvoId, 'Pessoa');
    await this.#d.repositorio.definirMembro(pessoaId, evento.id, alvo, dados);
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'equipe.definir', dados: { eventoId: evento.id, pessoaId: alvo, papeis: dados.papeis } });
  }

  async removerMembro(pessoaId: string, slug: string, alvoId: string): Promise<void> {
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    const alvo = exigirUuid(alvoId, 'Pessoa');
    if (!(await this.#d.repositorio.removerMembro(pessoaId, evento.id, alvo))) {
      throw new ErroDominio('nao_encontrado', 'Pessoa não encontrada na equipe, ou você não pode removê-la.');
    }
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'equipe.remover', dados: { eventoId: evento.id, pessoaId: alvo } });
  }

  async convidarParaEvento(pessoaId: string, slug: string, corpo: unknown): Promise<{ id: string; expiraEm: string }> {
    const dados = validarConvite(corpo, PAPEIS_EVENTO);
    const evento = await this.#eventoDaEquipe(pessoaId, slug);
    return this.#convidar(pessoaId, dados, { organizacaoId: evento.organizacaoId, eventoId: evento.id }, { organizacao: evento.organizacao, evento: evento.nome });
  }

  async convidarParaOrganizacao(pessoaId: string, organizacaoId: string, corpo: unknown): Promise<{ id: string; expiraEm: string }> {
    const dados = validarConvite(corpo, PAPEIS_ORGANIZACAO);
    const org = await this.#d.repositorio.organizacao(pessoaId, exigirUuid(organizacaoId, 'Organização'));
    if (!org) throw new ErroDominio('nao_encontrado', 'Organização não encontrada.');
    return this.#convidar(pessoaId, dados, { organizacaoId: org.id, eventoId: null }, { organizacao: org.nome, evento: null });
  }

  async #convidar(
    pessoaId: string, dados: { email: string; papeis: string[] },
    alvo: { organizacaoId: string; eventoId: string | null }, nomes: { organizacao: string; evento: string | null },
  ): Promise<{ id: string; expiraEm: string }> {
    const convite = await this.#d.repositorio.criarConvite(pessoaId, {
      ...alvo,
      emailCifrado: this.#d.protecao.cifrar(dados.email, CONTEXTO_EMAIL),
      emailHash: this.#d.protecao.indice(dados.email, CONTEXTO_EMAIL),
      papeis: dados.papeis,
    });
    // O e-mail convidado não vai para a auditoria: ela guarda quem convidou e para quê.
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'convite.criar', dados: { ...alvo, conviteId: convite.id, papeis: dados.papeis } });
    const { assunto, texto } = textoDoConvite({ ...nomes, papeis: dados.papeis });
    await this.#d.enviarEmail(dados.email, assunto, texto).catch(() => undefined);
    return convite;
  }

  async revogarConvite(pessoaId: string, id: string): Promise<void> {
    const conviteId = exigirUuid(id, 'Convite');
    if (!(await this.#d.repositorio.revogarConvite(pessoaId, conviteId))) {
      throw new ErroDominio('nao_encontrado', 'Convite não encontrado, já respondido ou você não pode cancelá-lo.');
    }
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'convite.revogar', dados: { conviteId } });
  }

  async aceitarConvite(pessoaId: string, id: string): Promise<void> {
    const conviteId = exigirUuid(id, 'Convite');
    if (!(await this.#d.repositorio.aceitarConvite(pessoaId, conviteId))) {
      throw new ErroDominio('regra', 'Este convite não vale mais. Peça um novo a quem convidou.');
    }
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'convite.aceitar', dados: { conviteId } });
  }

  convites(pessoaId: string): Promise<ConvitePendente[]> {
    return this.#d.repositorio.convitesPendentes(pessoaId);
  }
}

/** Casos de uso do controle de acesso: regras, credenciais, pacote do leitor, leituras e "Chegou o dia". */
import { ErroDominio, exigirUuid } from '../../../shared/dominio/erro.ts';
import type { Auditoria } from '../../../shared/dominio/erro.ts';
import { emitirToken, validadeDoEvento } from '../../../shared/qr/token.ts';
import type { Assinador } from '../../../shared/qr/token.ts';
import { validarEmailDeConvite } from '../../organizacao/domain/organizacao.ts';
import {
  DOCUMENTO_DA_MEIA, validarConferencia, validarEmissao, validarExcecao, validarLeituras, validarMotivo, validarRegras,
} from '../domain/acessos.ts';
import type { Excecao, Leitura, Regra, SituacaoLeitura } from '../domain/acessos.ts';
import type { Categoria } from '../../cadastros/domain/catalogo.ts';

export interface EventoAcessos {
  readonly id: string; readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string;
  readonly papeis: readonly string[];
}
export interface CredencialLista {
  readonly id: string; readonly ingressoId: string | null; readonly nome: string; readonly categoria: Categoria;
  readonly tipo: string | null; readonly recursos: readonly string[]; readonly revogada: boolean;
  readonly entrada: { readonly em: string; readonly portao: string } | null;
}
export interface ZonaLeitor { readonly id: string; readonly nome: string; readonly aberta: boolean }
export interface PontoLeitor { readonly id: string; readonly nome: string; readonly zonaId: string | null; readonly tipo: string; readonly modo: string }
export interface MeiaLeitor { readonly id: string; readonly credencialId: string; readonly motivo: string; readonly resultado: string | null }
export interface PontoHoje extends PontoLeitor {
  readonly zona: string | null; readonly ativo: boolean; readonly ultimaSincEm: string | null;
  readonly entradas: number; readonly credenciais: number; readonly saidas: number; readonly negadas: number; readonly ultimaLeituraEm: string | null;
}
export interface MinhaCredencial {
  readonly id: string; readonly ingressoId: string | null; readonly categoria: Categoria; readonly revogada: boolean;
  readonly evento: { readonly id: string; readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string; readonly local: string };
  readonly parceiro: string | null;
}

export interface RepositorioAcessos {
  evento(pessoaId: string, slug: string): Promise<EventoAcessos | null>;
  regras(pessoaId: string, eventoId: string): Promise<Regra[]>;
  /** Troca as regras da zona; falso se a zona não é deste evento. */
  definirRegras(pessoaId: string, eventoId: string, zonaId: string, regras: readonly Omit<Regra, 'zonaId'>[]): Promise<boolean>;
  credenciais(pessoaId: string, eventoId: string): Promise<CredencialLista[]>;
  garantirPessoa(pessoaId: string, emailCifrado: Uint8Array, emailHash: Uint8Array): Promise<string>;
  emitir(pessoaId: string, eventoId: string, alvoId: string, categoria: Categoria): Promise<string>;
  revogar(pessoaId: string, eventoId: string, credencialId: string, motivo: string): Promise<boolean>;
  excecoes(pessoaId: string, eventoId: string): Promise<(Excecao & { readonly motivo: string })[]>;
  definirExcecao(pessoaId: string, eventoId: string, credencialId: string, zonaId: string, efeito: string, motivo: string): Promise<void>;
  removerExcecao(pessoaId: string, eventoId: string, credencialId: string, zonaId: string): Promise<boolean>;
  zonas(pessoaId: string, eventoId: string): Promise<ZonaLeitor[]>;
  pontos(pessoaId: string, eventoId: string): Promise<PontoLeitor[]>;
  meias(pessoaId: string, eventoId: string): Promise<MeiaLeitor[]>;
  conferirMeia(pessoaId: string, eventoId: string, id: string, resultado: string): Promise<boolean>;
  /** Grava o que ainda não existe e devolve a situação de cada leitura (ausente = ignorada). */
  registrar(pessoaId: string, eventoId: string, leituras: readonly Leitura[]): Promise<{ novas: string[]; situacao: Map<string, SituacaoLeitura> }>;
  marcarSincronizado(pessoaId: string, pontoId: string): Promise<void>;
  hoje(pessoaId: string, eventoId: string): Promise<PontoHoje[]>;
  numeros(pessoaId: string, eventoId: string): Promise<Readonly<Record<string, number>>>;
  minhas(pessoaId: string): Promise<MinhaCredencial[]>;
}

export interface DependenciasAcessos {
  readonly repositorio: RepositorioAcessos;
  readonly auditoria: Auditoria;
  readonly assinador: Assinador;
  readonly protecao: { cifrar(texto: string, contexto: string): Uint8Array; indice(valor: string, contexto: string): Uint8Array };
  readonly agoraMs: () => number;
}

const CONTEXTO_EMAIL = 'pessoa.email';
const PAPEIS_DE_PORTAO = ['dono', 'admin', 'credenciamento', 'operacao'];
/** Ponto sem sincronizar há mais que isto aparece em "Chegou o dia" pedindo atenção. */
export const LIMITE_SEM_SINCRONIZAR_MS = 30 * 60_000;

export class AcessosServico {
  readonly #d: DependenciasAcessos;

  constructor(d: DependenciasAcessos) {
    this.#d = d;
  }

  async #evento(pessoaId: string, slug: string, papeis?: readonly string[]): Promise<EventoAcessos> {
    const evento = await this.#d.repositorio.evento(pessoaId, slug);
    if (!evento || evento.papeis.length === 0) throw new ErroDominio('nao_encontrado', 'Evento não encontrado.');
    if (papeis && !evento.papeis.some((p) => papeis.includes(p))) {
      throw new ErroDominio('sem_permissao', 'Só a equipe de portão do evento pode fazer isso.');
    }
    return evento;
  }

  async regras(pessoaId: string, slug: string): Promise<{ regras: Regra[] }> {
    const evento = await this.#evento(pessoaId, slug);
    return { regras: await this.#d.repositorio.regras(pessoaId, evento.id) };
  }

  async definirRegras(pessoaId: string, slug: string, zonaId: string, corpo: unknown): Promise<void> {
    const regras = validarRegras(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const zona = exigirUuid(zonaId, 'Zona');
    if (!(await this.#d.repositorio.definirRegras(pessoaId, evento.id, zona, regras))) throw new ErroDominio('nao_encontrado', 'Zona não encontrada neste evento.');
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'zona.regras', dados: { eventoId: evento.id, zonaId: zona, categorias: regras.map((r) => r.categoria) } });
  }

  async credenciais(pessoaId: string, slug: string) {
    const evento = await this.#evento(pessoaId, slug, PAPEIS_DE_PORTAO);
    const [credenciais, excecoes] = await Promise.all([
      this.#d.repositorio.credenciais(pessoaId, evento.id),
      this.#d.repositorio.excecoes(pessoaId, evento.id),
    ]);
    return { credenciais, excecoes };
  }

  /** Emite credencial para um e-mail; se a pessoa ainda não tem conta, ela é criada e completa o cadastro ao entrar. */
  async emitir(pessoaId: string, slug: string, corpo: unknown): Promise<{ id: string }> {
    const { emailBruto, categoria } = validarEmissao(corpo);
    const email = validarEmailDeConvite(emailBruto);
    const evento = await this.#evento(pessoaId, slug);
    const alvo = await this.#d.repositorio.garantirPessoa(pessoaId, this.#d.protecao.cifrar(email, CONTEXTO_EMAIL), this.#d.protecao.indice(email, CONTEXTO_EMAIL));
    const id = await this.#d.repositorio.emitir(pessoaId, evento.id, alvo, categoria);
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'credencial.emitir', dados: { eventoId: evento.id, credencialId: id, categoria } });
    return { id };
  }

  async revogar(pessoaId: string, slug: string, credencialId: string, corpo: unknown): Promise<void> {
    const motivo = validarMotivo(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const id = exigirUuid(credencialId, 'Credencial');
    if (!(await this.#d.repositorio.revogar(pessoaId, evento.id, id, motivo))) {
      throw new ErroDominio('nao_encontrado', 'Credencial não encontrada, já cancelada ou você não pode cancelá-la.');
    }
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'credencial.revogar', dados: { eventoId: evento.id, credencialId: id, motivo } });
  }

  async definirExcecao(pessoaId: string, slug: string, credencialId: string, zonaId: string, corpo: unknown): Promise<void> {
    const { efeito, motivo } = validarExcecao(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const [credencial, zona] = [exigirUuid(credencialId, 'Credencial'), exigirUuid(zonaId, 'Zona')];
    await this.#d.repositorio.definirExcecao(pessoaId, evento.id, credencial, zona, efeito, motivo);
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'credencial.excecao', dados: { eventoId: evento.id, credencialId: credencial, zonaId: zona, efeito, motivo } });
  }

  async removerExcecao(pessoaId: string, slug: string, credencialId: string, zonaId: string): Promise<void> {
    const evento = await this.#evento(pessoaId, slug);
    const [credencial, zona] = [exigirUuid(credencialId, 'Credencial'), exigirUuid(zonaId, 'Zona')];
    if (!(await this.#d.repositorio.removerExcecao(pessoaId, evento.id, credencial, zona))) throw new ErroDominio('nao_encontrado', 'Exceção não encontrada.');
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'credencial.excecao_remover', dados: { eventoId: evento.id, credencialId: credencial, zonaId: zona } });
  }

  /** Tudo o que o leitor precisa para decidir sem internet (ADR 0026). */
  async pacote(pessoaId: string, slug: string) {
    const evento = await this.#evento(pessoaId, slug, PAPEIS_DE_PORTAO);
    const r = this.#d.repositorio;
    const [credenciais, zonas, regras, excecoes, pontos, meias] = await Promise.all([
      r.credenciais(pessoaId, evento.id), r.zonas(pessoaId, evento.id), r.regras(pessoaId, evento.id),
      r.excecoes(pessoaId, evento.id), r.pontos(pessoaId, evento.id), r.meias(pessoaId, evento.id),
    ]);
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'acessos.pacote', dados: { eventoId: evento.id, credenciais: credenciais.length } });
    return {
      evento: { id: evento.id, slug: evento.slug, nome: evento.nome, inicio: evento.inicio, fim: evento.fim },
      chaves: [{ kid: this.#d.assinador.kid, publica: this.#d.assinador.chavePublica }],
      credenciais,
      zonas,
      regras,
      // O motivo da exceção fica na organização; o leitor só precisa do efeito.
      excecoes: excecoes.map(({ credencialId, zonaId, efeito }) => ({ credencialId, zonaId, efeito })),
      pontos,
      meias: meias.map((m) => ({ ...m, documento: DOCUMENTO_DA_MEIA[m.motivo] ?? 'documento que comprove a meia-entrada' })),
      geradoEm: new Date(this.#d.agoraMs()).toISOString(),
    };
  }

  async sincronizar(pessoaId: string, slug: string, corpo: unknown): Promise<{ id: string; situacao: SituacaoLeitura }[]> {
    const evento = await this.#evento(pessoaId, slug, PAPEIS_DE_PORTAO);
    const lote = validarLeituras(corpo, this.#d.agoraMs());
    const { novas, situacao } = await this.#d.repositorio.registrar(pessoaId, evento.id, lote);
    for (const l of lote) {
      if (l.metodo === 'manual' && novas.includes(l.id)) {
        await this.#d.auditoria.registrar({
          atorId: pessoaId, acao: 'leitura.manual',
          dados: { eventoId: evento.id, credencialId: l.credencialId, ingressoId: l.ingressoId, pontoId: l.pontoId, resultado: l.resultado },
        });
      }
    }
    // Cada ponto que mandou leituras acabou de falar com a API: vale como sincronização.
    for (const pontoId of new Set(lote.map((l) => l.pontoId).filter((p): p is string => p !== null))) {
      await this.#d.repositorio.marcarSincronizado(pessoaId, pontoId).catch(() => undefined);
    }
    return lote.map((l) => ({ id: l.id, situacao: situacao.get(l.id) ?? 'ignorada' }));
  }

  async conferirMeia(pessoaId: string, slug: string, id: string, corpo: unknown): Promise<void> {
    const resultado = validarConferencia(corpo);
    const evento = await this.#evento(pessoaId, slug);
    const meiaId = exigirUuid(id, 'Declaração');
    if (!(await this.#d.repositorio.conferirMeia(pessoaId, evento.id, meiaId, resultado))) {
      throw new ErroDominio('nao_encontrado', 'Declaração de meia-entrada não encontrada, ou você não pode conferi-la.');
    }
    // O motivo é dado sensível: a auditoria guarda só que houve conferência e o resultado.
    await this.#d.auditoria.registrar({ atorId: pessoaId, acao: 'meia.conferir', dados: { eventoId: evento.id, resultado } });
  }

  /** "Chegou o dia": entradas registradas por ponto e o que pede atenção. Nunca lotação. */
  async hoje(pessoaId: string, slug: string) {
    const evento = await this.#evento(pessoaId, slug);
    const [pontos, numeros] = await Promise.all([this.#d.repositorio.hoje(pessoaId, evento.id), this.#d.repositorio.numeros(pessoaId, evento.id)]);
    const agora = this.#d.agoraMs();
    return {
      numeros,
      pontos: pontos.map((p) => {
        const semSinc = p.ultimaSincEm === null ? null : Math.floor((agora - Date.parse(p.ultimaSincEm)) / 60_000);
        const atencao = !p.ativo ? null
          : semSinc === null ? 'Ainda não sincronizou. Abra o leitor neste ponto com internet.'
            : semSinc * 60_000 > LIMITE_SEM_SINCRONIZAR_MS ? `Sem atualizar há ${semSinc} min. Peça para abrir o leitor com internet.` : null;
        return { ...p, minutosSemSincronizar: semSinc, atencao };
      }),
      geradoEm: new Date(agora).toISOString(),
    };
  }

  /** Credenciais da própria pessoa, cada uma com o QR assinado que funciona sem internet. */
  async minhas(pessoaId: string) {
    const credenciais = await this.#d.repositorio.minhas(pessoaId);
    return {
      credenciais: credenciais.map((c) => ({
        ...c,
        qr: c.revogada ? null : emitirToken(
          { ...(c.ingressoId ? { i: c.ingressoId } : { c: c.id }), e: c.evento.id, x: validadeDoEvento(c.evento.fim) }, this.#d.assinador),
      })),
    };
  }
}

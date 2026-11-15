/** Chamadas da área do organizador, do portal do expositor e das credenciais (docs/api.md). */
import type { Requisitor } from '../../shared/api/cliente';

export interface Convite { readonly id: string; readonly organizacao: string; readonly evento: string | null; readonly parceiro: string | null; readonly papeis: readonly string[]; readonly expiraEm: string }
export interface EventoOrganizado { readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string; readonly publicado: boolean; readonly demonstracao: boolean; readonly papeis: readonly string[] }
export interface Inicio { readonly eventos: readonly EventoOrganizado[]; readonly convites: readonly Convite[] }
export interface Participacao { readonly id: string; readonly parceiro: string; readonly categoria: string; readonly situacao: string; readonly papel: string | null; readonly evento: { readonly slug: string; readonly nome: string } }
export interface MinhaCredencial {
  readonly id: string; readonly categoria: string; readonly revogada: boolean; readonly parceiro: string | null; readonly qr: string | null;
  readonly evento: { readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string; readonly local: string };
}
export interface Aviso { readonly id: string; readonly titulo: string; readonly corpo: string; readonly urgente: boolean; readonly publicadoEm: string }
export interface PontoHoje {
  readonly id: string; readonly nome: string; readonly zona: string | null; readonly ativo: boolean; readonly entradas: number; readonly saidas: number;
  readonly negadas: number; readonly ultimaLeituraEm: string | null; readonly minutosSemSincronizar: number | null; readonly atencao: string | null;
}
export interface Hoje { readonly numeros: { readonly inscritos: number; readonly credenciais: number; readonly entradas: number; readonly leiturasNegadas: number }; readonly pontos: readonly PontoHoje[]; readonly geradoEm: string }
export interface EstandeDoMapa { readonly id: string; readonly codigo: string; readonly situacao: 'livre' | 'reservado' | 'vendido'; readonly tipo: string; readonly larguraM: number; readonly profundidadeM: number; readonly precoCentavos: number }
export interface Portal {
  readonly participacao: Participacao;
  readonly resumo: { readonly estandes: number; readonly areaM2: number; readonly investimentoCentavos: number; readonly nivel: string | null; readonly credenciaisDireito: number; readonly proximoNivel: { readonly nome: string; readonly faltamCentavos: number } | null };
  readonly estandes: readonly { readonly id: string; readonly codigo: string; readonly situacao: string; readonly reservadoAte: string | null; readonly valorCentavos: number | null; readonly tipo: string }[];
  readonly perfil: { readonly nomeExibicao: string; readonly publicado: boolean } | null;
  readonly pedidos: readonly { readonly id: string; readonly servico: string; readonly unidade: string; readonly quantidade: number; readonly valorCentavos: number; readonly situacao: string }[];
  readonly montagem: { readonly tipo: string; readonly situacao: string; readonly observacao: string | null } | null;
  readonly equipe: readonly { readonly pessoaId: string; readonly nome: string; readonly papel: string; readonly credencialId: string | null; readonly credencialRevogada: boolean | null }[];
  readonly contratos: readonly { readonly id: string; readonly situacao: string; readonly via: string; readonly valorCentavos: number; readonly corpo: string }[];
  readonly pendencias: readonly string[];
}

export interface ApiAreas {
  inicio(): Promise<Inicio>;
  participacoes(): Promise<Participacao[]>;
  credenciais(): Promise<MinhaCredencial[]>;
  aceitarConvite(id: string): Promise<void>;
  hoje(slug: string): Promise<Hoje>;
  avisos(slug: string): Promise<Aviso[]>;
  portal(id: string): Promise<Portal>;
  mapa(slug: string): Promise<EstandeDoMapa[]>;
  reservar(id: string, estandeId: string): Promise<void>;
  liberar(id: string, estandeId: string): Promise<void>;
  assinar(contratoId: string): Promise<void>;
  emitirCredencial(id: string, pessoaId: string): Promise<void>;
}

export function apiAreas(requisitar: Requisitor): ApiAreas {
  const ler = async <T>(caminho: string): Promise<T> => (await requisitar<T>('GET', caminho)).dados as T;
  const enviar = async (metodo: 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown): Promise<void> => {
    await requisitar(metodo, caminho, corpo === undefined ? {} : { corpo });
  };
  const s = encodeURIComponent;
  return {
    inicio: () => ler<Inicio>('/organizador/inicio'),
    participacoes: async () => (await ler<{ participacoes: Participacao[] }>('/portal')).participacoes,
    credenciais: async () => (await ler<{ credenciais: MinhaCredencial[] }>('/credenciais')).credenciais,
    aceitarConvite: (id) => enviar('POST', `/convites/${s(id)}/aceitar`),
    hoje: (slug) => ler<Hoje>(`/organizador/eventos/${s(slug)}/hoje`),
    avisos: async (slug) => (await ler<{ avisos: Aviso[] }>(`/eventos/${s(slug)}/avisos`)).avisos,
    portal: (id) => ler<Portal>(`/portal/${s(id)}`),
    mapa: async (slug) => (await ler<{ estandes: EstandeDoMapa[] }>(`/eventos/${s(slug)}/expositores`)).estandes,
    reservar: (id, estandeId) => enviar('PUT', `/portal/${s(id)}/estandes/${s(estandeId)}`),
    liberar: (id, estandeId) => enviar('DELETE', `/portal/${s(id)}/estandes/${s(estandeId)}`),
    assinar: (contratoId) => enviar('POST', `/contratos/${s(contratoId)}/assinar`, {}),
    emitirCredencial: (id, pessoaId) => enviar('POST', `/portal/${s(id)}/credenciais`, { pessoaId }),
  };
}

export const NOME_DO_PAPEL: Readonly<Record<string, string>> = {
  dono: 'Dono', admin: 'Administração', conteudo: 'Conteúdo', credenciamento: 'Credenciamento', financeiro: 'Financeiro', comercial: 'Comercial',
  comunicacao: 'Comunicação', operacao: 'Operação', acessibilidade: 'Acessibilidade', responsavel: 'Responsável', equipe: 'Equipe',
};
export const papeisPorExtenso = (papeis: readonly string[]): string => papeis.map((p) => NOME_DO_PAPEL[p] ?? p).join(', ');

/** Papéis que abrem o leitor neste celular (os mesmos que a API aceita em /acessos). */
export const podeLer = (papeis: readonly string[]): boolean => papeis.some((p) => ['dono', 'admin', 'credenciamento', 'operacao'].includes(p));

export const reais = (centavos: number): string => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

export function periodo(inicio: string, fim: string): string {
  const f = (d: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)).replace('.', '');
  return inicio === fim ? f(inicio) : `${f(inicio)} a ${f(fim)}`;
}

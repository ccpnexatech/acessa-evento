/**
 * Modelo e regras puras da agenda: tipos, dias, seções e filtros.
 * Sem React e sem rede, para testar sem esforço.
 */
export type Recurso = 'libras' | 'legenda' | 'audiodescricao';

export interface Atividade {
  readonly id: string;
  readonly titulo: string;
  readonly resumo: string | null;
  readonly inicio: string;
  readonly fim: string;
  readonly recursos: readonly Recurso[];
  readonly sala: { readonly nome: string; readonly local: string; readonly acessibilidade: string | null } | null;
  readonly palestrantes: readonly { readonly nome: string; readonly cargo: string | null }[];
}

export interface Evento {
  readonly id: string;
  readonly slug: string;
  readonly nome: string;
  readonly inicio: string;
  readonly fim: string;
  readonly local: string;
  readonly fuso: string;
}

export interface Agenda {
  readonly evento: Evento;
  readonly atividades: readonly Atividade[];
  readonly versao: string;
}

export const NOME_RECURSO: Readonly<Record<Recurso, string>> = {
  libras: 'Libras',
  legenda: 'Legenda',
  audiodescricao: 'Audiodescrição',
};

const formatador = (fuso: string, opcoes: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, ...opcoes });

/** Data local do evento (AAAA-MM-DD) de um instante, no fuso do evento. */
export function diaLocal(instante: string, fuso: string): string {
  const partes = formatador(fuso, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instante));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

export function hora(instante: string, fuso: string): string {
  return formatador(fuso, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instante));
}

export interface Dia {
  readonly id: string;
  /** Ex.: "Qua" */
  readonly semana: string;
  /** Ex.: "1 jul" */
  readonly data: string;
  /** Ex.: "quarta-feira, 1 de julho", para o leitor de tela. */
  readonly extenso: string;
}

export function dias(atividades: readonly Atividade[], fuso: string): Dia[] {
  const ids = [...new Set(atividades.map((a) => diaLocal(a.inicio, fuso)))].sort();
  return ids.map((id) => {
    const meioDia = new Date(`${id}T12:00:00Z`);
    const semana = formatador('UTC', { weekday: 'short' }).format(meioDia).replace('.', '');
    const data = formatador('UTC', { day: 'numeric', month: 'short' }).format(meioDia).replace('.', '').replace(' de ', ' ');
    return {
      id,
      semana: semana.charAt(0).toUpperCase() + semana.slice(1),
      data,
      extenso: formatador('UTC', { weekday: 'long', day: 'numeric', month: 'long' }).format(meioDia),
    };
  });
}

export interface Filtro {
  readonly busca: string;
  readonly recursos: readonly Recurso[];
  readonly soFavoritas: boolean;
}

const semAcento = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrar(atividades: readonly Atividade[], f: Filtro, favoritas: ReadonlySet<string>): Atividade[] {
  const termo = semAcento(f.busca.trim());
  return atividades.filter((a) =>
    (!f.soFavoritas || favoritas.has(a.id))
    && f.recursos.every((r) => a.recursos.includes(r))
    && (!termo || semAcento([a.titulo, a.resumo ?? '', ...a.palestrantes.map((p) => p.nome)].join(' ')).includes(termo)));
}

export interface Secao {
  readonly titulo: 'Agora' | 'A seguir' | 'Já passou';
  readonly atividades: readonly Atividade[];
}

/** Agora (em andamento), A seguir e Já passou, nessa ordem; seções vazias somem. */
export function secoes(atividades: readonly Atividade[], agora: Date): Secao[] {
  const t = agora.getTime();
  const grupos: Record<Secao['titulo'], Atividade[]> = { Agora: [], 'A seguir': [], 'Já passou': [] };
  for (const a of atividades) {
    const ini = new Date(a.inicio).getTime();
    const fim = new Date(a.fim).getTime();
    grupos[t >= fim ? 'Já passou' : t >= ini ? 'Agora' : 'A seguir'].push(a);
  }
  return (['Agora', 'A seguir', 'Já passou'] as const).filter((k) => grupos[k].length).map((titulo) => ({ titulo, atividades: grupos[titulo] }));
}

/** Dia que a agenda abre: hoje, se for dia de evento; senão, o primeiro dia. */
export function diaInicial(lista: readonly Dia[], agora: Date, fuso: string): string | null {
  const hoje = diaLocal(agora.toISOString(), fuso);
  return lista.find((d) => d.id === hoje)?.id ?? lista[0]?.id ?? null;
}

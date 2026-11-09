/** Tipos e regras puras da inscrição (feature 02), iguais aos da API. */
export type RecursoEvento = 'libras' | 'legenda' | 'audiodescricao' | 'acesso_sem_degraus';
export type RecursoPedido = RecursoEvento | 'acompanhante';
export type Metodo = 'pix' | 'cartao';

export const NOME_RECURSO_EVENTO: Readonly<Record<RecursoPedido, string>> = {
  libras: 'Libras',
  legenda: 'Legenda',
  audiodescricao: 'Audiodescrição',
  acesso_sem_degraus: 'Acesso sem degraus',
  acompanhante: 'Acompanhante',
};

/** Como o pedido aparece na inscrição: o que a pessoa ganha, não o nome técnico. */
export const PEDIDOS_ACESSIBILIDADE: readonly { valor: RecursoPedido; rotulo: string; dica: string }[] = [
  { valor: 'libras', rotulo: 'Intérprete de Libras', dica: 'Lugar reservado perto do intérprete.' },
  { valor: 'legenda', rotulo: 'Legenda ao vivo', dica: 'Telão ou celular com a fala em texto.' },
  { valor: 'audiodescricao', rotulo: 'Audiodescrição', dica: 'Fone com a descrição do que aparece no palco.' },
  { valor: 'acesso_sem_degraus', rotulo: 'Acesso sem degraus', dica: 'Rotas com rampa ou elevador e lugar para cadeira de rodas.' },
  { valor: 'acompanhante', rotulo: 'Acompanhante', dica: 'Entrada de uma pessoa de apoio com você.' },
];

export interface ResumoEvento {
  readonly id: string;
  readonly slug: string;
  readonly nome: string;
  readonly inicio: string;
  readonly fim: string;
  readonly local: string;
  readonly recursosOferecidos: readonly RecursoEvento[];
  readonly inscricoesAbertas: boolean;
}

export interface TipoIngresso {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly precoCentavos: number;
  readonly esgotado: boolean;
}

export interface DetalheEvento extends ResumoEvento {
  readonly descricao: string | null;
  readonly fuso: string;
  readonly tipos: readonly TipoIngresso[];
  readonly destaques: readonly { readonly titulo: string; readonly inicio: string }[];
}

export interface Ingresso {
  readonly id: string;
  readonly evento: { readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string; readonly local: string };
  readonly tipo: string;
  readonly emitidoEm: string;
}

export const reais = (centavos: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

/** "1 a 3 de jul. de 2026" — datas de calendário, sem fuso. */
export function periodo(inicio: string, fim: string): string {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`));
  if (inicio === fim) return f(inicio, { day: 'numeric', month: 'long', year: 'numeric' });
  const mesmoMes = inicio.slice(0, 7) === fim.slice(0, 7);
  return mesmoMes
    ? `${f(inicio, { day: 'numeric' })} a ${f(fim, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `${f(inicio, { day: 'numeric', month: 'long' })} a ${f(fim, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** Só dígitos, agrupados de 4 em 4 para leitura. */
export const formatarCartao = (texto: string): string =>
  texto.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

export function luhnValido(numero: string): boolean {
  const d = numero.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let soma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
  }
  return soma % 10 === 0;
}

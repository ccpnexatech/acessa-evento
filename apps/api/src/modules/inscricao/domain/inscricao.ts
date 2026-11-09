/** Regras puras da inscrição e do pagamento (feature 02). Sem I/O. */
export type RecursoEvento = 'libras' | 'legenda' | 'audiodescricao' | 'acesso_sem_degraus';
export type RecursoPedido = RecursoEvento | 'acompanhante';
export type Metodo = 'pix' | 'cartao';
export type StatusPedido = 'pendente' | 'aprovado' | 'recusado';

export const RECURSOS_EVENTO: readonly RecursoEvento[] = ['libras', 'legenda', 'audiodescricao', 'acesso_sem_degraus'];
export const RECURSOS_PEDIDO: readonly RecursoPedido[] = [...RECURSOS_EVENTO, 'acompanhante'];

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
  /** Algumas atividades para a página do evento; a agenda completa fica em /agenda. */
  readonly destaques: readonly { readonly titulo: string; readonly inicio: string }[];
}

export interface Pedido {
  readonly id: string;
  readonly status: StatusPedido;
  readonly metodo: Metodo;
  readonly valorCentavos: number;
  readonly tipoIngressoId: string;
  readonly eventoId: string;
}

export interface Ingresso {
  readonly id: string;
  readonly evento: { readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string; readonly local: string };
  readonly tipo: string;
  readonly emitidoEm: string;
}

export interface DadosInscricao {
  readonly tipoIngressoId: string;
  readonly recursos: readonly RecursoPedido[];
  readonly metodo: Metodo;
  /** Só existe no caminho até o provedor; nunca é guardado nem registrado em log. */
  readonly cartao: { readonly numero: string } | null;
}

export type CodigoErroInscricao =
  | 'evento_inexistente' | 'tipo_inexistente' | 'inscricoes_fechadas' | 'esgotado'
  | 'ja_inscrito' | 'dados_invalidos' | 'chave_invalida' | 'pagamento_recusado';

export class ErroInscricao extends Error {
  readonly codigo: CodigoErroInscricao;
  readonly campo: string | undefined;

  constructor(codigo: CodigoErroInscricao, mensagem: string, campo?: string) {
    super(mensagem);
    this.name = 'ErroInscricao';
    this.codigo = codigo;
    this.campo = campo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{3,60}$/;
const CHAVE = /^[A-Za-z0-9_-]{16,100}$/;

export function validarSlug(slug: string): string {
  if (!SLUG.test(slug)) throw new ErroInscricao('evento_inexistente', 'Evento não encontrado.');
  return slug;
}

export function validarChave(chave: string | undefined): string {
  if (!chave || !CHAVE.test(chave)) {
    throw new ErroInscricao('chave_invalida', 'Envie o cabeçalho Idempotency-Key com 16 a 100 letras, números, - ou _.');
  }
  return chave;
}

export function filtroRecurso(valor: string | null): RecursoEvento | null {
  if (valor === null || valor === '') return null;
  if (!(RECURSOS_EVENTO as readonly string[]).includes(valor)) throw new ErroInscricao('dados_invalidos', 'Recurso desconhecido.', 'recurso');
  return valor as RecursoEvento;
}

/** Algoritmo de Luhn: pega erro de digitação antes de ir ao provedor. */
export function luhnValido(numero: string): boolean {
  let soma = 0;
  for (let i = 0; i < numero.length; i++) {
    let d = Number(numero[numero.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validarInscricao(corpo: unknown): DadosInscricao {
  if (!objeto(corpo)) throw new ErroInscricao('dados_invalidos', 'Envie os dados da inscrição.');
  const { tipoIngressoId, recursos = [], metodo, cartao } = corpo;
  if (typeof tipoIngressoId !== 'string' || !UUID.test(tipoIngressoId)) {
    throw new ErroInscricao('dados_invalidos', 'Escolha um tipo de ingresso.', 'tipoIngressoId');
  }
  if (!Array.isArray(recursos) || recursos.some((r) => !(RECURSOS_PEDIDO as readonly unknown[]).includes(r))) {
    throw new ErroInscricao('dados_invalidos', 'Recurso de acessibilidade desconhecido.', 'recursos');
  }
  if (metodo !== 'pix' && metodo !== 'cartao') throw new ErroInscricao('dados_invalidos', 'Escolha Pix ou cartão.', 'metodo');
  let dadosCartao: DadosInscricao['cartao'] = null;
  if (metodo === 'cartao') {
    const numero = objeto(cartao) && typeof cartao['numero'] === 'string' ? cartao['numero'].replace(/[\s.-]/g, '') : '';
    if (!/^[0-9]{13,19}$/.test(numero) || !luhnValido(numero)) {
      throw new ErroInscricao('dados_invalidos', 'Número de cartão inválido. Confira os dígitos.', 'cartao.numero');
    }
    dadosCartao = { numero };
  }
  return { tipoIngressoId, recursos: [...new Set(recursos as RecursoPedido[])], metodo, cartao: dadosCartao };
}

/** Pedidos de acessibilidade são apagados 30 dias após o fim do evento (ADR 0012). */
export function dataExpurgo(fimEvento: string): string {
  const d = new Date(`${fimEvento}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}

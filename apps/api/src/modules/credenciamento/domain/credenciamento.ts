/** Regras puras do credenciamento (feature 04). */
export type MetodoCheckin = 'qr' | 'manual';
export type Situacao = 'valido' | 'repetido';

export interface CheckinEnviado {
  /** Gerado no aparelho: reenviar a fila não duplica. */
  readonly id: string;
  readonly ingressoId: string;
  readonly portao: string;
  readonly metodo: MetodoCheckin;
  /** Hora do aparelho na leitura (ISO 8601). */
  readonly feitoEm: string;
}

export interface Participante {
  readonly ingressoId: string;
  readonly nome: string;
  readonly tipo: string;
  readonly recursos: readonly string[];
  readonly checkin: { readonly em: string; readonly portao: string } | null;
}

export interface EventoEquipe {
  readonly id: string;
  readonly slug: string;
  readonly nome: string;
  readonly inicio: string;
  readonly fim: string;
}

export type CodigoErroCredenciamento = 'evento_inexistente' | 'sem_papel' | 'dados_invalidos';

export class ErroCredenciamento extends Error {
  readonly codigo: CodigoErroCredenciamento;

  constructor(codigo: CodigoErroCredenciamento, mensagem: string) {
    super(mensagem);
    this.name = 'ErroCredenciamento';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 200 check-ins cabem com folga no limite de 64 KB do corpo.
export const MAXIMO_POR_LOTE = 200;
/** Hora do aparelho pode estar errada, mas não a ponto de vir do futuro distante. */
const TOLERANCIA_FUTURO_MS = 10 * 60_000;

const invalido = (m: string) => new ErroCredenciamento('dados_invalidos', m);

export function validarLote(corpo: unknown, agoraMs: number): CheckinEnviado[] {
  const lista = (corpo as { checkins?: unknown } | null)?.checkins;
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie a lista de check-ins.');
  if (lista.length > MAXIMO_POR_LOTE) throw invalido(`Envie no máximo ${MAXIMO_POR_LOTE} check-ins por vez.`);
  return lista.map((c: unknown, i) => {
    const x = (c ?? {}) as Record<string, unknown>;
    const onde = `Check-in ${i + 1}`;
    if (typeof x['id'] !== 'string' || !UUID.test(x['id'])) throw invalido(`${onde}: id inválido.`);
    if (typeof x['ingressoId'] !== 'string' || !UUID.test(x['ingressoId'])) throw invalido(`${onde}: ingresso inválido.`);
    const portao = typeof x['portao'] === 'string' ? x['portao'].trim() : '';
    if (portao.length < 1 || portao.length > 40) throw invalido(`${onde}: informe o portão (até 40 letras).`);
    if (x['metodo'] !== 'qr' && x['metodo'] !== 'manual') throw invalido(`${onde}: método inválido.`);
    // Check-in manual só com documento conferido (feature 04, "Check-in manual").
    if (x['metodo'] === 'manual' && x['documentoConferido'] !== true) throw invalido(`${onde}: confira um documento com foto antes do check-in manual.`);
    const feito = typeof x['feitoEm'] === 'string' ? Date.parse(x['feitoEm']) : Number.NaN;
    if (Number.isNaN(feito) || feito > agoraMs + TOLERANCIA_FUTURO_MS) throw invalido(`${onde}: horário inválido.`);
    return { id: x['id'].toLowerCase(), ingressoId: x['ingressoId'].toLowerCase(), portao, metodo: x['metodo'], feitoEm: new Date(feito).toISOString() };
  });
}

/** Mesma regra do banco: por ingresso, o primeiro pelo horário (desempate pelo id) vale. */
export function situacoes(checkins: readonly Pick<CheckinEnviado, 'id' | 'ingressoId' | 'feitoEm'>[]): Map<string, Situacao> {
  const ordenados = [...checkins].sort((a, b) => a.feitoEm.localeCompare(b.feitoEm) || a.id.localeCompare(b.id));
  const vistos = new Set<string>();
  const r = new Map<string, Situacao>();
  for (const c of ordenados) {
    r.set(c.id, vistos.has(c.ingressoId) ? 'repetido' : 'valido');
    vistos.add(c.ingressoId);
  }
  return r;
}

/**
 * Regras do credenciamento no aparelho da equipe (feature 04), puras:
 * a leitura do QR decide "pode entrar", "já entrou" ou "não reconhecido"
 * sem internet, com a lista baixada e a fila local.
 */
import { lerToken } from './token';
import type { Verificador } from './token';

export interface Participante {
  readonly ingressoId: string;
  readonly nome: string;
  readonly tipo: string;
  readonly recursos: readonly string[];
  readonly checkin: { readonly em: string; readonly portao: string } | null;
}

export interface Pacote {
  readonly evento: { readonly id: string; readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string };
  readonly chaves: readonly { readonly kid: string; readonly publica: string }[];
  readonly participantes: readonly Participante[];
  readonly geradoEm: string;
}

export interface CheckinLocal {
  readonly id: string;
  readonly ingressoId: string;
  readonly portao: string;
  readonly metodo: 'qr' | 'manual';
  readonly feitoEm: string;
  readonly documentoConferido?: true;
}

export type Resultado =
  | { readonly tipo: 'valido'; readonly ingressoId: string; readonly participante: Participante | null }
  | { readonly tipo: 'repetido'; readonly ingressoId: string; readonly participante: Participante | null; readonly anterior: { readonly em: string; readonly portao: string } }
  | { readonly tipo: 'invalido'; readonly motivo: 'formato' | 'assinatura' | 'vencido' | 'outro_evento' };

/** Primeiro check-in conhecido: o que veio na lista do servidor ou o que este aparelho já fez. */
export function primeiroCheckin(ingressoId: string, pacote: Pacote, locais: readonly CheckinLocal[]): { em: string; portao: string } | null {
  const candidatos = [
    ...pacote.participantes.filter((p) => p.ingressoId === ingressoId && p.checkin).map((p) => p.checkin as { em: string; portao: string }),
    ...locais.filter((c) => c.ingressoId === ingressoId).map((c) => ({ em: c.feitoEm, portao: c.portao })),
  ];
  return candidatos.sort((a, b) => a.em.localeCompare(b.em))[0] ?? null;
}

export function avaliarIngresso(ingressoId: string, pacote: Pacote, locais: readonly CheckinLocal[]): Resultado {
  const participante = pacote.participantes.find((p) => p.ingressoId === ingressoId) ?? null;
  const anterior = primeiroCheckin(ingressoId, pacote, locais);
  return anterior ? { tipo: 'repetido', ingressoId, participante, anterior } : { tipo: 'valido', ingressoId, participante };
}

export function avaliarLeitura(texto: string, pacote: Pacote, verificador: Verificador, locais: readonly CheckinLocal[], agoraMs: number): Resultado {
  const leitura = lerToken(texto, verificador, pacote.evento.id, Math.floor(agoraMs / 1000));
  if (!leitura.ok) return { tipo: 'invalido', motivo: leitura.motivo };
  return avaliarIngresso(leitura.conteudo.i, pacote, locais);
}

/** O que a equipe faz por cada recurso pedido na inscrição. */
export const ORIENTACAO_RECURSO: Readonly<Record<string, { precisa: string; onde: string }>> = {
  libras: { precisa: 'Precisa de intérprete de Libras', onde: 'Indique os lugares reservados perto do intérprete, à esquerda do palco.' },
  legenda: { precisa: 'Pediu legenda ao vivo', onde: 'Mostre o QR da legenda no celular, no balcão de informações.' },
  audiodescricao: { precisa: 'Precisa de audiodescrição', onde: 'Entregue um fone de audiodescrição no balcão de acessibilidade.' },
  acesso_sem_degraus: { precisa: 'Precisa de acesso sem degraus', onde: 'Indique a rampa da entrada lateral e os lugares para cadeira de rodas.' },
  acompanhante: { precisa: 'Vem com acompanhante', onde: 'Libere a entrada da pessoa de apoio junto com este ingresso.' },
};

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function buscarPorNome(pacote: Pacote, termo: string): Participante[] {
  const t = sem(termo.trim());
  if (t.length < 2) return [];
  return pacote.participantes.filter((p) => sem(p.nome).includes(t)).slice(0, 30);
}

export function horaCurta(iso: string, fuso = 'America/Fortaleza'): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** "hoje às 08:12" ou "em 1 jul às 08:12". */
export function quando(iso: string, agoraMs: number, fuso = 'America/Fortaleza'): string {
  const dia = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d);
  const data = new Date(iso);
  if (dia(data) === dia(new Date(agoraMs))) return `hoje às ${horaCurta(iso, fuso)}`;
  const curto = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: 'numeric', month: 'short' }).format(data).replace('.', '');
  return `em ${curto} às ${horaCurta(iso, fuso)}`;
}

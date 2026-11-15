/**
 * Leitor por ponto (feature 08), puro: com o pacote baixado e as leituras que
 * este aparelho já fez, decide "pode entrar", "já entrou", "não entra aqui" ou
 * "QR não reconhecido", sem internet.
 */
import { lerToken } from '../credenciamento/token';
import type { Verificador } from '../credenciamento/token';
import { decidir } from './regra';
import type { Excecao, MotivoNegado, Regra } from './regra';

export interface Credencial {
  readonly id: string;
  readonly ingressoId: string | null;
  readonly nome: string;
  readonly categoria: string;
  readonly tipo: string | null;
  readonly recursos: readonly string[];
  readonly revogada: boolean;
  readonly entrada: { readonly em: string; readonly portao: string } | null;
}
export interface Zona { readonly id: string; readonly nome: string; readonly aberta: boolean }
export interface Ponto { readonly id: string; readonly nome: string; readonly zonaId: string | null; readonly tipo: string; readonly modo: 'entrada_unica' | 'passagem_livre' }
export interface Meia { readonly id: string; readonly credencialId: string; readonly motivo: string; readonly resultado: string | null; readonly documento: string }

export interface PacoteAcessos {
  readonly evento: { readonly id: string; readonly slug: string; readonly nome: string; readonly inicio: string; readonly fim: string };
  readonly chaves: readonly { readonly kid: string; readonly publica: string }[];
  readonly credenciais: readonly Credencial[];
  readonly zonas: readonly Zona[];
  readonly regras: readonly Regra[];
  readonly excecoes: readonly Excecao[];
  readonly pontos: readonly Ponto[];
  readonly meias: readonly Meia[];
  readonly geradoEm: string;
}

/** Leitura feita neste aparelho, no formato que a API recebe em /acessos/:slug/leituras. */
export interface LeituraLocal {
  readonly id: string;
  readonly credencialId: string;
  readonly pontoId: string;
  readonly sentido: 'entrada' | 'saida';
  readonly resultado: 'liberado' | 'negado';
  readonly metodo: 'qr' | 'manual';
  readonly feitoEm: string;
  readonly documentoConferido?: true;
}

export type ResultadoLeitura =
  | { readonly tipo: 'liberado'; readonly credencial: Credencial; readonly meia: Meia | null }
  | { readonly tipo: 'repetido'; readonly credencial: Credencial; readonly anterior: { readonly em: string; readonly onde: string } }
  | { readonly tipo: 'negado'; readonly credencial: Credencial; readonly motivo: MotivoNegado }
  | { readonly tipo: 'invalido'; readonly motivo: 'formato' | 'assinatura' | 'vencido' | 'outro_evento' | 'desconhecida' };

/** Primeira entrada liberada conhecida neste lugar (evento ou zona), só em pontos de entrada única. */
function entradaAnterior(c: Credencial, ponto: Ponto, pacote: PacoteAcessos, locais: readonly LeituraLocal[]): { em: string; onde: string } | null {
  const pontos = new Map(pacote.pontos.map((p) => [p.id, p]));
  const candidatos = locais
    .filter((l) => l.credencialId === c.id && l.resultado === 'liberado' && l.sentido === 'entrada')
    .flatMap((l) => {
      const p = pontos.get(l.pontoId);
      return p && p.modo === 'entrada_unica' && p.zonaId === ponto.zonaId ? [{ em: l.feitoEm, onde: p.nome }] : [];
    });
  // O que o servidor já sabia vale para a entrada do evento; das zonas, o aparelho só conhece as próprias leituras.
  if (ponto.zonaId === null && c.entrada) candidatos.push({ em: c.entrada.em, onde: c.entrada.portao });
  return candidatos.sort((a, b) => a.em.localeCompare(b.em))[0] ?? null;
}

export function avaliarCredencial(c: Credencial, ponto: Ponto, pacote: PacoteAcessos, locais: readonly LeituraLocal[], agoraMs: number): ResultadoLeitura {
  const zona = ponto.zonaId === null ? null : pacote.zonas.find((z) => z.id === ponto.zonaId);
  const decisao = decidir(c, zona, pacote.regras, pacote.excecoes, agoraMs);
  if (!decisao.entra) return { tipo: 'negado', credencial: c, motivo: decisao.motivo };
  if (ponto.modo === 'entrada_unica') {
    const anterior = entradaAnterior(c, ponto, pacote, locais);
    if (anterior) return { tipo: 'repetido', credencial: c, anterior };
  }
  // Meia-entrada ainda não conferida aparece na entrada do evento, que é onde o documento é pedido.
  const meia = ponto.zonaId === null ? pacote.meias.find((m) => m.credencialId === c.id && m.resultado === null) ?? null : null;
  return { tipo: 'liberado', credencial: c, meia };
}

export function avaliarLeitura(texto: string, ponto: Ponto, pacote: PacoteAcessos, verificador: Verificador, locais: readonly LeituraLocal[], agoraMs: number): ResultadoLeitura {
  const lido = lerToken(texto, verificador, pacote.evento.id, Math.floor(agoraMs / 1000));
  if (!lido.ok) return { tipo: 'invalido', motivo: lido.motivo };
  const { i, c } = lido.conteudo;
  const credencial = pacote.credenciais.find((x) => (c ? x.id === c : x.ingressoId === i && !x.revogada))
    ?? pacote.credenciais.find((x) => x.ingressoId === i);
  // Assinatura confere, mas a lista deste aparelho não tem a credencial: falta sincronizar.
  if (!credencial) return { tipo: 'invalido', motivo: 'desconhecida' };
  return avaliarCredencial(credencial, ponto, pacote, locais, agoraMs);
}

export const NOME_DA_CATEGORIA: Readonly<Record<string, string>> = {
  congressista: 'Congressista', palestrante: 'Palestrante', convidado: 'Convidado', expositor: 'Expositor', equipe: 'Equipe',
  alimentacao: 'Alimentação', entretenimento: 'Entretenimento', limpeza: 'Limpeza', seguranca: 'Segurança', montagem: 'Montagem', marketing: 'Marketing',
};

/** O que a equipe lê na tela quando a leitura não libera. Texto, não só cor. */
export function explicar(r: Exclude<ResultadoLeitura, { tipo: 'liberado' | 'repetido' }>): { titulo: string; oQueFazer: string } {
  if (r.tipo === 'negado') {
    if (r.motivo === 'credencial_revogada') return { titulo: 'Credencial cancelada', oQueFazer: 'Encaminhe à organização.' };
    if (r.motivo === 'excecao') return { titulo: 'Não entra aqui', oQueFazer: 'A organização barrou esta pessoa nesta área. Encaminhe à coordenação.' };
    if (r.motivo === 'zona_desconhecida') return { titulo: 'Ponto desatualizado', oQueFazer: 'Sincronize este aparelho com internet e leia de novo.' };
    return { titulo: 'Não entra aqui', oQueFazer: `${NOME_DA_CATEGORIA[r.credencial.categoria] ?? 'Esta categoria'} não tem acesso a esta área.` };
  }
  if (r.motivo === 'vencido') return { titulo: 'QR vencido', oQueFazer: 'Peça para a pessoa abrir o app com internet e mostrar o QR de novo.' };
  if (r.motivo === 'outro_evento') return { titulo: 'QR de outro evento', oQueFazer: 'Confira se a pessoa abriu o ingresso deste evento.' };
  if (r.motivo === 'desconhecida') return { titulo: 'Fora da lista deste aparelho', oQueFazer: 'Sincronize com internet e leia de novo, ou busque pelo nome.' };
  return { titulo: 'QR não reconhecido', oQueFazer: 'Peça o QR do Acessa Evento, ou busque a pessoa pelo nome.' };
}

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function buscarCredencial(pacote: PacoteAcessos, termo: string): Credencial[] {
  const t = sem(termo.trim());
  if (t.length < 2) return [];
  return pacote.credenciais.filter((c) => !c.revogada && sem(c.nome).includes(t)).slice(0, 30);
}

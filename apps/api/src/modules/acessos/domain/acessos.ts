/** Regras puras do controle de acesso (feature 08, ADR 0026). Sem I/O. */
import { ErroDominio, UUID } from '../../../shared/dominio/erro.ts';
import { CATEGORIAS } from '../../cadastros/domain/catalogo.ts';
import type { Categoria } from '../../cadastros/domain/catalogo.ts';

export interface Regra {
  readonly zonaId: string;
  readonly categoria: Categoria;
  /** Janela opcional (ISO 8601): fora dela a regra não vale. */
  readonly de: string | null;
  readonly ate: string | null;
}

export interface Excecao {
  readonly credencialId: string;
  readonly zonaId: string;
  readonly efeito: 'permite' | 'nega';
}

export interface CredencialDoLeitor {
  readonly id: string;
  readonly categoria: Categoria;
  readonly revogada: boolean;
}

export type MotivoNegado = 'credencial_revogada' | 'sem_regra' | 'excecao' | 'zona_desconhecida';
export type Decisao = { readonly entra: true } | { readonly entra: false; readonly motivo: MotivoNegado };

/**
 * A mesma regra de `pode_entrar` no banco, para o leitor decidir sem internet:
 * credencial revogada nunca entra; exceção pessoal ganha da regra; zona aberta
 * aceita todos; senão, precisa de regra da categoria valendo agora. Sem zona, é
 * a entrada do evento. O app tem uma cópia desta função, travada pelos mesmos casos de teste.
 */
export function decidir(
  credencial: CredencialDoLeitor,
  zona: { readonly id: string; readonly aberta: boolean } | null | undefined,
  regras: readonly Regra[],
  excecoes: readonly Excecao[],
  quandoMs: number,
): Decisao {
  if (credencial.revogada) return { entra: false, motivo: 'credencial_revogada' };
  if (zona === null) return { entra: true };
  if (zona === undefined) return { entra: false, motivo: 'zona_desconhecida' };
  const excecao = excecoes.find((x) => x.credencialId === credencial.id && x.zonaId === zona.id);
  if (excecao) return excecao.efeito === 'permite' ? { entra: true } : { entra: false, motivo: 'excecao' };
  if (zona.aberta) return { entra: true };
  const vale = regras.some((r) => r.zonaId === zona.id && r.categoria === credencial.categoria
    && (r.de === null || Date.parse(r.de) <= quandoMs) && (r.ate === null || Date.parse(r.ate) > quandoMs));
  return vale ? { entra: true } : { entra: false, motivo: 'sem_regra' };
}

const invalido = (m: string) => new ErroDominio('dados_invalidos', m);
const objeto = (corpo: unknown): Record<string, unknown> => (corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo as Record<string, unknown> : {});
const instante = (bruto: unknown, rotulo: string): string | null => {
  if (bruto === undefined || bruto === null || bruto === '') return null;
  const ms = typeof bruto === 'string' ? Date.parse(bruto) : Number.NaN;
  if (Number.isNaN(ms)) throw invalido(`${rotulo}: informe data e hora.`);
  return new Date(ms).toISOString();
};
const texto = (bruto: unknown, rotulo: string, min: number, max: number): string => {
  const t = typeof bruto === 'string' ? bruto.trim() : '';
  if (t.length < min || t.length > max) throw invalido(`${rotulo}: use de ${min} a ${max} letras.`);
  return t;
};

/** Regras de uma zona, enviadas inteiras: a lista substitui a anterior. */
export function validarRegras(corpo: unknown): Omit<Regra, 'zonaId'>[] {
  const lista = objeto(corpo)['regras'];
  if (!Array.isArray(lista) || lista.length > CATEGORIAS.length) throw invalido('Regras: envie a lista de categorias que entram na zona.');
  const vistas = new Set<string>();
  return lista.map((r: unknown) => {
    const x = objeto(r);
    const categoria = x['categoria'];
    if (typeof categoria !== 'string' || !(CATEGORIAS as readonly string[]).includes(categoria)) throw invalido('Categoria: escolha uma das opções.');
    if (vistas.has(categoria)) throw invalido('Categoria: cada categoria aparece uma vez só por zona.');
    vistas.add(categoria);
    const [de, ate] = [instante(x['de'], 'Entra a partir de'), instante(x['ate'], 'Entra até')];
    if (de && ate && de >= ate) throw invalido('Entra até: precisa ser depois do início da janela.');
    return { categoria: categoria as Categoria, de, ate };
  });
}

/** Categorias que a organização emite à mão. Congressista nasce do ingresso; expositor, do contrato. */
export const CATEGORIAS_EMITIDAS = CATEGORIAS.filter((c) => c !== 'congressista');

export function validarEmissao(corpo: unknown): { emailBruto: unknown; categoria: Categoria } {
  const x = objeto(corpo);
  const categoria = x['categoria'];
  if (typeof categoria !== 'string' || !(CATEGORIAS_EMITIDAS as readonly string[]).includes(categoria)) {
    throw invalido('Categoria: escolha uma das opções. Congressista recebe a credencial ao se inscrever.');
  }
  return { emailBruto: x['email'], categoria: categoria as Categoria };
}

export const validarMotivo = (corpo: unknown): string => texto(objeto(corpo)['motivo'], 'Motivo', 3, 200);

export function validarExcecao(corpo: unknown): { efeito: 'permite' | 'nega'; motivo: string } {
  const x = objeto(corpo);
  if (x['efeito'] !== 'permite' && x['efeito'] !== 'nega') throw invalido('Efeito: escolha liberar ou barrar.');
  return { efeito: x['efeito'], motivo: texto(x['motivo'], 'Motivo', 3, 200) };
}

export interface Leitura {
  /** Gerado no aparelho: reenviar a fila não duplica. */
  readonly id: string;
  readonly credencialId: string | null;
  readonly ingressoId: string | null;
  readonly pontoId: string | null;
  readonly portao: string | null;
  readonly sentido: 'entrada' | 'saida';
  readonly resultado: 'liberado' | 'negado';
  readonly metodo: 'qr' | 'manual';
  readonly feitoEm: string;
}

export type SituacaoLeitura = 'registrada' | 'repetida' | 'ignorada';
export const MAXIMO_POR_LOTE = 200;
const TOLERANCIA_FUTURO_MS = 10 * 60_000;

export function validarLeituras(corpo: unknown, agoraMs: number): Leitura[] {
  const lista = objeto(corpo)['leituras'];
  if (!Array.isArray(lista) || lista.length === 0) throw invalido('Envie a lista de leituras.');
  if (lista.length > MAXIMO_POR_LOTE) throw invalido(`Envie no máximo ${MAXIMO_POR_LOTE} leituras por vez.`);
  return lista.map((l: unknown, i) => {
    const x = objeto(l);
    const onde = `Leitura ${i + 1}`;
    const uuid = (campo: string, obrigatorio: boolean): string | null => {
      const v = x[campo];
      if (v === undefined || v === null) {
        if (obrigatorio) throw invalido(`${onde}: ${campo} inválido.`);
        return null;
      }
      if (typeof v !== 'string' || !UUID.test(v)) throw invalido(`${onde}: ${campo} inválido.`);
      return v.toLowerCase();
    };
    const [credencialId, ingressoId, pontoId] = [uuid('credencialId', false), uuid('ingressoId', false), uuid('pontoId', false)];
    if ((credencialId === null) === (ingressoId === null)) throw invalido(`${onde}: informe a credencial ou o ingresso.`);
    const portao = typeof x['portao'] === 'string' ? x['portao'].trim() : '';
    if (pontoId === null && (portao.length < 1 || portao.length > 40)) throw invalido(`${onde}: informe o ponto de leitura.`);
    const sentido = x['sentido'] ?? 'entrada';
    if (sentido !== 'entrada' && sentido !== 'saida') throw invalido(`${onde}: sentido inválido.`);
    const resultado = x['resultado'] ?? 'liberado';
    if (resultado !== 'liberado' && resultado !== 'negado') throw invalido(`${onde}: resultado inválido.`);
    if (x['metodo'] !== 'qr' && x['metodo'] !== 'manual') throw invalido(`${onde}: método inválido.`);
    // Liberar à mão só com documento conferido, como na v1 (feature 04).
    if (x['metodo'] === 'manual' && resultado === 'liberado' && x['documentoConferido'] !== true) {
      throw invalido(`${onde}: confira um documento com foto antes de liberar à mão.`);
    }
    const feito = typeof x['feitoEm'] === 'string' ? Date.parse(x['feitoEm']) : Number.NaN;
    if (Number.isNaN(feito) || feito > agoraMs + TOLERANCIA_FUTURO_MS) throw invalido(`${onde}: horário inválido.`);
    return { id: uuid('id', true) as string, credencialId, ingressoId, pontoId, portao: portao || null, sentido, resultado, metodo: x['metodo'], feitoEm: new Date(feito).toISOString() };
  });
}

export function validarConferencia(corpo: unknown): 'confirmada' | 'recusada' {
  const r = objeto(corpo)['resultado'];
  if (r !== 'confirmada' && r !== 'recusada') throw invalido('Resultado: informe se o documento foi apresentado.');
  return r;
}

/** O documento que a equipe pede na entrada para cada motivo de meia-entrada. */
export const DOCUMENTO_DA_MEIA: Readonly<Record<string, string>> = {
  estudante: 'carteira de estudante',
  idoso: 'documento com foto e data de nascimento',
  pcd: 'documento que comprove a deficiência',
  acompanhante_pcd: 'estar com a pessoa que acompanha',
  jovem_baixa_renda: 'ID Jovem',
  professor: 'comprovante de vínculo como professor',
  doador_sangue: 'carteira de doador de sangue',
};

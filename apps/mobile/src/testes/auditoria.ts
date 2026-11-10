/**
 * Auditoria automática de acessibilidade sobre a árvore renderizada (feature 06).
 * Confere, em cada tela e tema:
 *  - todo controle tem papel e nome acessível;
 *  - todo controle tem alvo de toque de pelo menos 48 pt (altura e largura, com hitSlop);
 *  - todo texto tem contraste de 4,5:1 com o fundo real (3:1 se for texto grande);
 *  - nenhum texto é cortado com reticências (fonte em 200%);
 *  - campos e imagens têm nome.
 * Controles desabilitados ficam fora do contraste, como na WCAG.
 */
import { StyleSheet } from 'react-native';
import { contraste, tamanho } from '@acessa-evento/tokens';

/** Formato do toJSON() da Testing Library (só o que usamos). */
export interface No {
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly (No | string)[] | null;
}
type Estilo = { [k: string]: unknown };

const PAPEIS_DE_CONTROLE = new Set(['button', 'togglebutton', 'tab', 'radio', 'checkbox', 'link', 'switch', 'menuitem']);
const ALVO = tamanho.touchMin;

export interface Violacao {
  readonly regra: 'nome' | 'papel' | 'alvo' | 'contraste' | 'corte' | 'campo' | 'imagem';
  readonly onde: string;
  readonly detalhe: string;
}

const estilo = (n: No): Estilo => (StyleSheet.flatten(n.props['style'] as never) ?? {}) as Estilo;
const filhos = (n: No): No[] => (n.children ?? []).filter((c): c is No => typeof c === 'object');

function textoDe(n: No | string): string {
  if (typeof n === 'string') return n;
  if (n.props['accessibilityElementsHidden'] || n.props['importantForAccessibility'] === 'no-hide-descendants') return '';
  return (n.children ?? []).map(textoDe).join('');
}

function hex(cor: unknown): string | null {
  if (typeof cor !== 'string') return null;
  if (/^#[0-9a-f]{6}$/i.test(cor)) return cor;
  if (/^#[0-9a-f]{3}$/i.test(cor)) return `#${[...cor.slice(1)].map((c) => c + c).join('')}`;
  return null;
}

function numero(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function alvoOk(n: No): { ok: boolean; altura: number | null; largura: number | null } {
  const e = estilo(n);
  const slop = n.props['hitSlop'];
  const s = typeof slop === 'number' ? { top: slop, bottom: slop, left: slop, right: slop } : (slop as Record<string, number> | undefined) ?? {};
  const alturaBase = numero(e['height']) ?? numero(e['minHeight']);
  const larguraBase = numero(e['width']) ?? numero(e['minWidth']);
  const altura = alturaBase === null ? null : alturaBase + (s['top'] ?? 0) + (s['bottom'] ?? 0);
  // Sem largura fixa, o controle ocupa a linha (flex) e a largura não limita o alvo.
  const largura = larguraBase === null ? null : larguraBase + (s['left'] ?? 0) + (s['right'] ?? 0);
  return { ok: altura !== null && altura >= ALVO && (largura === null || largura >= ALVO), altura, largura };
}

function textoGrande(e: Estilo): boolean {
  const corpo = numero(e['fontSize']) ?? 14;
  const negrito = ['bold', '600', '700', '800', '900'].includes(String(e['fontWeight'] ?? ''));
  return corpo >= 24 || (negrito && corpo >= 18.66);
}

export function auditar(raiz: No | No[] | null, fundoDaTela: string): Violacao[] {
  const v: Violacao[] = [];
  const visitar = (n: No, fundo: string, desabilitado: boolean) => {
    const e = estilo(n);
    const fundoAqui = hex(e['backgroundColor']) ?? fundo;
    const papel = n.props['accessibilityRole'] as string | undefined;
    const estado = (n.props['accessibilityState'] ?? {}) as { disabled?: boolean };
    const inativo = desabilitado || Boolean(estado.disabled);
    const nome = (n.props['accessibilityLabel'] as string | undefined) ?? textoDe(n).trim();
    const tocavel = typeof n.props['onClick'] === 'function' || typeof n.props['onResponderRelease'] === 'function';

    if (n.type === 'View' && tocavel) {
      const onde = nome || `(${papel ?? 'sem papel'})`;
      if (!papel || !PAPEIS_DE_CONTROLE.has(papel)) v.push({ regra: 'papel', onde, detalhe: `papel "${papel ?? 'nenhum'}"` });
      if (!nome) v.push({ regra: 'nome', onde, detalhe: 'controle sem nome acessível' });
      const alvo = alvoOk(n);
      if (!alvo.ok) v.push({ regra: 'alvo', onde, detalhe: `alvo ${alvo.altura ?? '?'} x ${alvo.largura ?? 'flex'} pt, mínimo ${ALVO}` });
    }
    if (n.type === 'TextInput' && !n.props['accessibilityLabel']) v.push({ regra: 'campo', onde: String(n.props['placeholder'] ?? 'campo'), detalhe: 'campo sem rótulo' });
    if (papel === 'image' && !n.props['accessibilityLabel']) v.push({ regra: 'imagem', onde: 'imagem', detalhe: 'imagem sem descrição' });

    if (n.type === 'Text') {
      if (n.props['numberOfLines']) v.push({ regra: 'corte', onde: textoDe(n), detalhe: 'numberOfLines corta o texto com fonte grande' });
      const proprio = (n.children ?? []).filter((c) => typeof c === 'string').join('').trim();
      const cor = hex(e['color']);
      if (proprio && cor && !inativo) {
        const r = contraste(cor, fundoAqui);
        const minimo = textoGrande(e) ? 3 : 4.5;
        if (r < minimo) v.push({ regra: 'contraste', onde: proprio.slice(0, 40), detalhe: `${r.toFixed(2)}:1 (${cor} sobre ${fundoAqui}), mínimo ${minimo}:1` });
      }
    }
    for (const f of filhos(n)) visitar(f, fundoAqui, inativo);
  };
  for (const n of Array.isArray(raiz) ? raiz : raiz ? [raiz] : []) visitar(n, fundoDaTela, false);
  return v;
}

export function descrever(v: readonly Violacao[]): string {
  return v.map((x) => `[${x.regra}] ${x.onde}: ${x.detalhe}`).join('\n');
}

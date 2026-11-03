/**
 * Gera src/tokens.ts a partir de tokens.json (exportado do design system).
 * O JSON é a fonte da verdade; o TS gerado é tipado e sem dependências,
 * para o app (React Native) e a web usarem do mesmo jeito.
 *
 * Uso: node scripts/gerar.ts            (escreve)
 *      node scripts/gerar.ts --conferir (falha se o arquivo estiver desatualizado)
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface TokenCor { name: string; value: Record<string, string> }
interface TokenSimples { name: string; value: string }
interface Estilo { name: string; fontSize: string; lineHeight: string; fontWeight: number }
interface Fonte {
  color: { themes: { id: string }[]; tokens: TokenCor[] };
  type: { families: Record<string, string>; groups: { family: string; styles: Estilo[] }[] };
  spacing: { tokens: TokenSimples[] };
  radius: { tokens: TokenSimples[] };
  size: { tokens: TokenSimples[] };
}

const raiz = new URL('../', import.meta.url);
const fonte = JSON.parse(readFileSync(new URL('tokens.json', raiz), 'utf8')) as Fonte;

const camel = (nome: string): string => nome.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const px = (v: string): number => {
  const n = Number(v.replace(/px$/, ''));
  if (!Number.isFinite(n)) throw new Error(`Valor não numérico: ${v}`);
  return n;
};
const tabela = (tokens: TokenSimples[], prefixo: string): Record<string, number> =>
  Object.fromEntries(tokens.map((t) => [camel(t.name.replace(prefixo, '')), px(t.value)]));

const temas = fonte.color.themes.map((t) => t.id);
const cores = Object.fromEntries(
  temas.map((tema) => [tema, Object.fromEntries(fonte.color.tokens.map((t) => {
    const valor = t.value[tema];
    if (!valor) throw new Error(`Token ${t.name} sem valor para o tema ${tema}`);
    return [camel(t.name), valor];
  }))]),
);
const tipografia = Object.fromEntries(
  fonte.type.groups.flatMap((g) => g.styles.map((s) => [camel(s.name), {
    familia: g.family,
    tamanho: px(s.fontSize),
    alturaLinha: px(s.lineHeight),
    peso: String(s.fontWeight),
  }])),
);

const corpo = `// Gerado por scripts/gerar.ts a partir de tokens.json. Não edite à mão.
export const temas = ${JSON.stringify(temas)} as const;
export type Tema = (typeof temas)[number];

export const cores = ${JSON.stringify(cores, null, 2)} as const;
export type NomeCor = keyof (typeof cores)['light'];

export const espaco = ${JSON.stringify(tabela(fonte.spacing.tokens, 'space-'), null, 2)} as const;
export const raio = ${JSON.stringify(tabela(fonte.radius.tokens, 'radius-'), null, 2)} as const;
export const tamanho = ${JSON.stringify(tabela(fonte.size.tokens, ''), null, 2)} as const;
export const tipografia = ${JSON.stringify(tipografia, null, 2)} as const;
`;

const destino = new URL('src/tokens.ts', raiz);
if (process.argv.includes('--conferir')) {
  if (readFileSync(destino, 'utf8') !== corpo) {
    process.stderr.write('✖ src/tokens.ts está desatualizado. Rode: npm run gerar -w @acessa-evento/tokens\n');
    process.exit(1);
  }
} else {
  writeFileSync(destino, corpo);
}

/**
 * Valida a mensagem de commit no padrão Conventional Commits.
 * Exemplo válido: "feat(api): expõe a rota /saude".
 */
import { readFileSync } from 'node:fs';

export const TIPOS = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] as const;

const CABECALHO = new RegExp(`^(?:${TIPOS.join('|')})(?:\\([a-z0-9-]+\\))?!?: \\S.{0,99}$`);

export function validarMensagem(mensagem: string): string | null {
  const cabecalho = mensagem.split('\n')[0]?.trim() ?? '';
  if (/^(?:Merge|Revert ")/.test(cabecalho)) return null;
  if (!CABECALHO.test(cabecalho)) {
    return `Cabeçalho fora do padrão: "${cabecalho}"\nUse: <tipo>(<escopo>): <descrição>, com tipo em ${TIPOS.join(', ')} e até 100 caracteres.`;
  }
  return null;
}

const arquivo = process.argv[2];
if (arquivo) {
  const mensagem = readFileSync(arquivo, 'utf8')
    .split('\n')
    .filter((l) => !l.startsWith('#'))
    .join('\n');
  const erro = validarMensagem(mensagem);
  if (erro) {
    process.stderr.write(`✖ ${erro}\n`);
    process.exit(1);
  }
}

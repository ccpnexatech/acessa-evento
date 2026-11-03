/**
 * Verificação de segurança sem serviço de terceiros:
 * 1. `npm audit` contra vulnerabilidades altas ou críticas nas dependências;
 * 2. varredura dos arquivos versionados atrás de segredos (chaves, tokens, senhas).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let falhou = false;

// 1. Dependências
const audit = spawnSync(npm, ['audit', '--audit-level=high'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (audit.status !== 0) {
  process.stderr.write('✖ npm audit encontrou vulnerabilidade alta ou crítica.\n');
  falhou = true;
}

// 2. Segredos nos arquivos versionados (e nos que estão para entrar no commit)
const PADROES: ReadonlyArray<readonly [string, RegExp]> = [
  ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |PGP |)PRIVATE KEY-----/],
  ['token do GitHub', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['chave da AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['token do Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['service role do Supabase', /service_role["'\s:=]+["']?eyJ/i],
  ['segredo atribuído', /\b(?:password|senha|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{12,}["']/i],
];
const IGNORAR = /(?:^|\/)(?:package-lock\.json|.*\.(?:png|jpg|jpeg|gif|webp|ico|ttf|otf|woff2?))$/;

const listar = (args: string[]): string[] =>
  execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

let arquivos: string[] = [];
try {
  arquivos = [...new Set([...listar(['ls-files']), ...listar(['diff', '--cached', '--name-only'])])];
} catch {
  process.stderr.write('⚠ Fora de um repositório git: varredura de segredos ignorada.\n');
}

for (const arquivo of arquivos) {
  if (IGNORAR.test(arquivo)) continue;
  let texto: string;
  try {
    if (statSync(arquivo).size > 1_000_000) continue;
    texto = readFileSync(arquivo, 'utf8');
  } catch {
    continue; // removido no índice
  }
  texto.split('\n').forEach((linha, i) => {
    if (linha.includes('segredo-permitido')) return; // marcação explícita para exemplos
    for (const [nome, re] of PADROES) {
      if (re.test(linha)) {
        process.stderr.write(`✖ Possível ${nome} em ${arquivo}:${i + 1}\n`);
        falhou = true;
      }
    }
  });
}

if (falhou) process.exit(1);
process.stdout.write(`✔ Segurança: dependências sem falhas altas e ${arquivos.length} arquivos sem segredos.\n`);

/**
 * Verificação de segurança sem serviço de terceiros:
 * 1. `npm audit` contra vulnerabilidades altas ou críticas nas dependências;
 * 2. varredura dos arquivos versionados atrás de segredos (chaves, tokens, senhas).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let falhou = false;

// 1. Dependências: resumo numa linha; detalhe só do que bloqueia (alta ou crítica).
const audit = spawnSync(npm, ['audit', '--json'], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
interface Relatorio {
  metadata?: { vulnerabilities?: Record<string, number> };
  vulnerabilities?: Record<string, { severity: string; via: unknown[] }>;
}
let relatorio: Relatorio = {};
try {
  relatorio = JSON.parse(audit.stdout || '{}') as Relatorio;
} catch {
  process.stderr.write('✖ npm audit não respondeu (sem internet ou registro fora do ar).\n');
  falhou = true;
}
const contagem = relatorio.metadata?.vulnerabilities ?? {};
const bloqueiam = Object.entries(relatorio.vulnerabilities ?? {}).filter(([, v]) => v.severity === 'high' || v.severity === 'critical');
if (bloqueiam.length) {
  for (const [nome, v] of bloqueiam) process.stderr.write(`✖ ${v.severity}: ${nome}\n`);
  process.stderr.write('Rode `npm audit` para ver os detalhes e a correção.\n');
  falhou = true;
} else if (relatorio.metadata) {
  const abaixo = ['low', 'moderate'].map((n) => `${contagem[n] ?? 0} ${n === 'low' ? 'baixa(s)' : 'moderada(s)'}`).join(', ');
  process.stdout.write(`✔ Dependências sem falha alta ou crítica (abaixo do limite: ${abaixo}).\n`);
}

// 2. Segredos nos arquivos versionados (e nos que estão para entrar no commit)
const PADROES: ReadonlyArray<readonly [string, RegExp]> = [
  ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |PGP |)PRIVATE KEY-----/],
  ['token do GitHub', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['chave da AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['token do Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['service role do Supabase', /service_role["'\s:=]+["']?eyJ/i],
  // Valor com cara de segredo: 16+ caracteres com letra e dígito (evita nomes como 'sessao.token').
  ['segredo atribuído', /\b(?:password|senha|secret|api[_-]?key|token)\s*[:=]\s*["'](?=[^"'\s]*\d)(?=[^"'\s]*[a-z])[^"'\s]{16,}["']/i],
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
process.stdout.write(`✔ ${arquivos.length} arquivos versionados sem segredos.\n`);

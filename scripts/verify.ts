/**
 * Portão de qualidade: roda, em ordem e parando no primeiro erro,
 * tudo o que precisa passar antes de qualquer push para a master.
 * Usado pelo hook pre-push e pelo CI, para que os dois rodem a mesma coisa.
 */
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

interface Etapa {
  readonly nome: string;
  readonly script: string;
}

const ETAPAS: readonly Etapa[] = [
  { nome: 'lint', script: 'lint' },
  { nome: 'typecheck', script: 'typecheck' },
  { nome: 'testes', script: 'test' },
  { nome: 'segurança', script: 'security' },
  { nome: 'e2e', script: 'e2e' },
];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const resultados: string[] = [];

for (const etapa of ETAPAS) {
  const inicio = performance.now();
  process.stdout.write(`\n▶ ${etapa.nome}\n`);
  const r = spawnSync(npm, ['run', '--silent', etapa.script], { stdio: 'inherit' });
  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
  if (r.status !== 0) {
    process.stderr.write(`\n✖ ${etapa.nome} falhou (${segundos}s). Nada foi enviado.\n`);
    process.exit(r.status ?? 1);
  }
  resultados.push(`✔ ${etapa.nome} (${segundos}s)`);
}

process.stdout.write(`\n${resultados.join('\n')}\n\nTudo verde.\n`);

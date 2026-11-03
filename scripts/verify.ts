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

// O projeto roda TypeScript direto no Node (type stripping), que chegou no 22.18.
const [maior = 0, menor = 0] = process.versions.node.split('.').map(Number);
if (maior < 22 || (maior === 22 && menor < 18)) {
  process.stderr.write(`✖ Node ${process.versions.node} é antigo para este projeto. Use 22.18 ou mais novo (nvm use).\n`);
  process.exit(1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const resultados: string[] = [];

for (const etapa of ETAPAS) {
  const inicio = performance.now();
  process.stdout.write(`\n▶ ${etapa.nome}\n`);
  const r = spawnSync(npm, ['run', '--silent', etapa.script], { stdio: 'inherit', shell: process.platform === 'win32' });
  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
  if (r.status !== 0) {
    process.stderr.write(`\n✖ ${etapa.nome} falhou (${segundos}s). Corrija antes de enviar; as etapas seguintes não rodaram.\n`);
    process.exit(r.status ?? 1);
  }
  resultados.push(`✔ ${etapa.nome} (${segundos}s)`);
}

process.stdout.write(`\n${resultados.join('\n')}\n\nTudo verde.\n`);

/**
 * Roda um comando com um PostgreSQL de teste disponível em DATABASE_URL_TESTE.
 *
 * - Se DATABASE_URL_TESTE já existir (CI, ou um banco seu), só repassa.
 * - Senão, sobe um cluster temporário com o initdb/pg_ctl da máquina numa
 *   porta livre, roda o comando e apaga tudo no fim. Sem Docker.
 *
 * Uso: node scripts/banco-teste.ts <comando> [args...]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

const [comando, ...args] = process.argv.slice(2);
if (!comando) {
  process.stderr.write('Uso: node scripts/banco-teste.ts <comando> [args...]\n');
  process.exit(2);
}

const rodar = (env: NodeJS.ProcessEnv): number =>
  spawnSync(comando, args, { stdio: 'inherit', env, shell: process.platform === 'win32' }).status ?? 1;

if (process.env['DATABASE_URL_TESTE']) process.exit(rodar(process.env));

function binarios(): string {
  try {
    return execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
  } catch {
    const base = '/usr/lib/postgresql';
    const versao = existsSync(base) ? readdirSync(base).sort((a, b) => Number(b) - Number(a))[0] : undefined;
    if (versao && existsSync(join(base, versao, 'bin', 'initdb'))) return join(base, versao, 'bin');
    process.stderr.write('✖ PostgreSQL não encontrado. Instale o PostgreSQL 16+ ou defina DATABASE_URL_TESTE.\n');
    process.exit(1);
  }
}

const portaLivre = (): Promise<number> =>
  new Promise((ok, falha) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    }).on('error', falha);
  });

const bin = binarios();
const dir = mkdtempSync(join(tmpdir(), 'acessa-pg-'));
const dados = join(dir, 'dados');
const porta = await portaLivre();

// O PostgreSQL não roda como root; em contêiner, usa o usuário postgres.
const comoRoot = userInfo().uid === 0;
const pg = (programa: string, a: string[]): void => {
  const exe = join(bin, programa);
  const r = comoRoot
    ? spawnSync('runuser', ['-u', 'postgres', '--', exe, ...a], { stdio: 'pipe' })
    : spawnSync(exe, a, { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`${programa} falhou: ${r.stderr.toString()}`);
};
if (comoRoot) {
  chmodSync(dir, 0o777);
}

let codigo = 1;
try {
  pg('initdb', ['-D', dados, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  pg('pg_ctl', ['-D', dados, '-w', '-l', join(dir, 'log.txt'), '-o', `-p ${porta} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c full_page_writes=off`, 'start']);
  codigo = rodar({ ...process.env, DATABASE_URL_TESTE: `postgres://postgres@127.0.0.1:${porta}/postgres` });
} catch (erro) {
  process.stderr.write(`✖ ${(erro as Error).message}\n`);
} finally {
  try {
    pg('pg_ctl', ['-D', dados, '-m', 'immediate', 'stop']);
  } catch {
    /* já parado */
  }
  rmSync(dir, { recursive: true, force: true });
}
process.exit(codigo);

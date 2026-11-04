/**
 * Roda um comando com um PostgreSQL de teste disponível em DATABASE_URL_TESTE.
 *
 * Ordem de tentativa:
 * 1. DATABASE_URL_TESTE já definida (CI ou um banco seu): só repassa.
 * 2. PostgreSQL instalado na máquina (initdb/pg_ctl): sobe um cluster
 *    temporário numa porta livre e apaga tudo no fim.
 * 3. Docker disponível: sobe um contêiner postgres:16-alpine descartável.
 * Sem nenhum dos três, explica como resolver.
 *
 * Uso: node scripts/banco-teste.ts <comando> [args...]
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acharBinariosPg, comoRoot, dockerDisponivel, executarPg, portaLivre } from './lib/postgres.ts';

const [comando, ...args] = process.argv.slice(2);
if (!comando) {
  process.stderr.write('Uso: node scripts/banco-teste.ts <comando> [args...]\n');
  process.exit(2);
}

const rodar = (env: NodeJS.ProcessEnv): number =>
  spawnSync(comando, args, { stdio: 'inherit', env, shell: process.platform === 'win32' }).status ?? 1;

const avisar = (texto: string): void => {
  process.stderr.write(`${texto}\n`);
};

if (process.env['DATABASE_URL_TESTE']) process.exit(rodar(process.env));

async function comClusterLocal(bin: string): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), 'acessa-pg-'));
  const dados = join(dir, 'dados');
  const porta = await portaLivre();
  if (comoRoot()) chmodSync(dir, 0o777);
  try {
    executarPg(bin, 'initdb', ['-D', dados, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
    executarPg(bin, 'pg_ctl', ['-D', dados, '-w', '-t', '30', '-l', join(dir, 'log.txt'), '-o',
      `-p ${porta} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c full_page_writes=off`, 'start']);
    return rodar({ ...process.env, DATABASE_URL_TESTE: `postgres://postgres@127.0.0.1:${porta}/postgres` });
  } finally {
    try {
      executarPg(bin, 'pg_ctl', ['-D', dados, '-m', 'immediate', 'stop']);
    } catch {
      /* já parado ou nunca subiu */
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

async function comDocker(): Promise<number> {
  const porta = await portaLivre();
  const nome = `acessa-pg-teste-${process.pid}`;
  const r = spawnSync('docker', ['run', '-d', '--rm', '--name', nome, '-e', 'POSTGRES_PASSWORD=teste',
    '-p', `127.0.0.1:${porta}:5432`, 'postgres:16-alpine'], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`docker run falhou: ${r.stderr.toString().trim()}`);
  try {
    const limite = Date.now() + 60_000;
    while (spawnSync('docker', ['exec', nome, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']).status !== 0) {
      if (Date.now() > limite) throw new Error('o contêiner do PostgreSQL não ficou pronto em 60 s');
      await new Promise((ok) => setTimeout(ok, 500));
    }
    return rodar({ ...process.env, DATABASE_URL_TESTE: `postgres://postgres:teste@127.0.0.1:${porta}/postgres` });
  } finally {
    spawnSync('docker', ['rm', '-f', nome], { stdio: 'ignore' });
  }
}

let codigo = 1;
try {
  const bin = acharBinariosPg(avisar);
  if (bin) {
    codigo = await comClusterLocal(bin);
  } else if (dockerDisponivel()) {
    avisar('ℹ PostgreSQL local não encontrado; usando um contêiner postgres:16-alpine.');
    codigo = await comDocker();
  } else {
    avisar([
      '✖ Os testes de integração precisam de um PostgreSQL 14 ou maior (16 recomendado). Escolha um:',
      '  • instalar o servidor:  sudo apt install postgresql-16   (macOS: brew install postgresql@16)',
      '  • ter o Docker rodando: o script sobe um contêiner sozinho',
      '  • apontar para um banco seu: DATABASE_URL_TESTE=postgres://usuario:senha@127.0.0.1:5432/postgres',
      '    (o usuário precisa ser superusuário: os testes criam e apagam databases e o papel app_api)',
    ].join('\n'));
  }
} catch (erro) {
  avisar(`✖ Não foi possível preparar o banco de teste: ${(erro as Error).message}`);
}
process.exit(codigo);

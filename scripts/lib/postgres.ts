/**
 * Utilidades para achar e controlar um PostgreSQL na máquina, sem dependências.
 * Usadas pelo banco de teste (scripts/banco-teste.ts) e pelo ambiente de
 * desenvolvimento (scripts/dev.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { userInfo } from 'node:os';
import { join } from 'node:path';

export const VERSAO_MINIMA_PG = 14;

/** Saída de um programa, ou null se ele não existir ou falhar. */
export function saida(programa: string, args: string[]): string | null {
  try {
    return execFileSync(programa, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function portaLivre(preferida = 0): Promise<number> {
  return new Promise((ok, falha) => {
    const s = createServer();
    s.once('error', (e: NodeJS.ErrnoException) => {
      if (preferida !== 0 && e.code === 'EADDRINUSE') ok(portaLivre(0));
      else falha(e);
    });
    s.listen(preferida, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

/** Pasta com initdb e pg_ctl na versão mínima ou maior; null se não houver. */
export function acharBinariosPg(avisar: (t: string) => void = () => undefined): string | null {
  const candidatas = new Set<string>();
  const doPgConfig = saida('pg_config', ['--bindir']);
  if (doPgConfig) candidatas.add(doPgConfig);
  const doPath = saida('which', ['initdb']);
  if (doPath) candidatas.add(join(doPath, '..'));
  for (const base of ['/usr/lib/postgresql', '/opt/homebrew/opt', '/usr/local/opt']) {
    if (!existsSync(base)) continue;
    for (const nome of readdirSync(base).sort().reverse()) {
      if (base === '/usr/lib/postgresql' || nome.startsWith('postgresql')) candidatas.add(join(base, nome, 'bin'));
    }
  }
  for (const pasta of candidatas) {
    const initdb = join(pasta, 'initdb');
    if (!existsSync(initdb) || !existsSync(join(pasta, 'pg_ctl'))) continue;
    const versao = Number(/(\d+)/.exec(saida(initdb, ['--version']) ?? '')?.[1] ?? 0);
    if (versao >= VERSAO_MINIMA_PG) return pasta;
    avisar(`⚠ Ignorando PostgreSQL ${versao} em ${pasta}: precisa ser ${VERSAO_MINIMA_PG} ou maior.`);
  }
  return null;
}

export const dockerDisponivel = (): boolean => saida('docker', ['info', '--format', '{{.ServerVersion}}']) !== null;

/** O PostgreSQL não roda como root; em contêiner, os binários rodam como o usuário postgres. */
export const comoRoot = (): boolean => process.platform !== 'win32' && userInfo().uid === 0;

/** Roda um binário do PostgreSQL (initdb, pg_ctl...) e lança erro legível se falhar. */
export function executarPg(bin: string, programa: string, args: string[]): void {
  const exe = join(bin, programa);
  const r = comoRoot()
    ? spawnSync('runuser', ['-u', 'postgres', '--', exe, ...args], { stdio: 'pipe' })
    : spawnSync(exe, args, { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`${programa} falhou: ${r.stderr.toString().trim() || r.error?.message || 'sem detalhes'}`);
}

/**
 * Migrador próprio (ADR 0013): aplica arquivos .sql numerados em ordem,
 * cada um numa transação, e guarda versão + SHA-256 numa tabela de controle.
 * Um arquivo já aplicado que mudou depois é erro: migração aplicada não se edita.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ClientBase } from 'pg';

export interface Migracao {
  readonly versao: string;
  readonly nome: string;
  readonly sql: string;
  readonly checksum: string;
}

const PADRAO_ARQUIVO = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const TRAVA = 7_341_022; // pg_advisory_lock: impede duas migrações simultâneas

export function lerMigracoes(pasta: string): Migracao[] {
  const arquivos = readdirSync(pasta).filter((a) => a.endsWith('.sql')).sort();
  const vistas = new Set<string>();
  return arquivos.map((arquivo) => {
    const m = PADRAO_ARQUIVO.exec(arquivo);
    if (!m?.[1] || !m[2]) throw new Error(`Nome de migração inválido: ${arquivo} (use 0001_descricao.sql)`);
    if (vistas.has(m[1])) throw new Error(`Versão de migração repetida: ${m[1]}`);
    vistas.add(m[1]);
    const sql = readFileSync(join(pasta, arquivo), 'utf8');
    return { versao: m[1], nome: m[2], sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
}

export interface ResultadoMigracao {
  readonly aplicadas: readonly string[];
  readonly jaAplicadas: number;
}

export async function migrar(cliente: ClientBase, migracoes: readonly Migracao[]): Promise<ResultadoMigracao> {
  await cliente.query('select pg_advisory_lock($1)', [TRAVA]);
  try {
    await cliente.query(`create table if not exists esquema_migracoes (
      versao text primary key,
      nome text not null,
      checksum text not null,
      aplicada_em timestamptz not null default now()
    )`);
    const { rows } = await cliente.query<{ versao: string; checksum: string }>('select versao, checksum from esquema_migracoes');
    const aplicadas = new Map(rows.map((r) => [r.versao, r.checksum]));

    for (const [versao, checksum] of aplicadas) {
      const atual = migracoes.find((m) => m.versao === versao);
      if (!atual) throw new Error(`A migração ${versao} está no banco mas não existe mais nos arquivos.`);
      if (atual.checksum !== checksum) {
        throw new Error(`A migração ${versao}_${atual.nome} mudou depois de aplicada. Crie uma nova migração em vez de editar.`);
      }
    }

    const novas: string[] = [];
    for (const m of migracoes) {
      if (aplicadas.has(m.versao)) continue;
      await cliente.query('begin');
      try {
        await cliente.query(m.sql);
        await cliente.query('insert into esquema_migracoes (versao, nome, checksum) values ($1, $2, $3)', [m.versao, m.nome, m.checksum]);
        await cliente.query('commit');
      } catch (erro) {
        await cliente.query('rollback');
        throw new Error(`Falha na migração ${m.versao}_${m.nome}: ${(erro as Error).message}`, { cause: erro });
      }
      novas.push(`${m.versao}_${m.nome}`);
    }
    return { aplicadas: novas, jaAplicadas: aplicadas.size };
  } finally {
    await cliente.query('select pg_advisory_unlock($1)', [TRAVA]);
  }
}

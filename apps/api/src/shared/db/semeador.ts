/** Aplica as sementes (.sql idempotentes) em ordem, numa transação só. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ClientBase } from 'pg';

export async function semear(cliente: ClientBase, pasta: string): Promise<string[]> {
  const arquivos = readdirSync(pasta).filter((a) => /^\d{4}_[a-z0-9_]+\.sql$/.test(a)).sort();
  await cliente.query('begin');
  try {
    for (const a of arquivos) await cliente.query(readFileSync(join(pasta, a), 'utf8'));
    await cliente.query('commit');
    return arquivos;
  } catch (erro) {
    await cliente.query('rollback');
    throw erro;
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarBancoDeTeste, PASTA_MIGRACOES } from '../apoio/banco.ts';
import { lerMigracoes, migrar } from '../../src/shared/db/migrador.ts';

test('aplica todas as migrações e é idempotente', async () => {
  const b = await criarBancoDeTeste({ migrar: false });
  try {
    const todas = lerMigracoes(PASTA_MIGRACOES);
    const primeira = await migrar(b.dono, todas);
    assert.equal(primeira.aplicadas.length, todas.length);
    const segunda = await migrar(b.dono, todas);
    assert.deepEqual(segunda, { aplicadas: [], jaAplicadas: todas.length });
  } finally {
    await b.apagar();
  }
});

test('recusa migração aplicada que foi editada depois', async () => {
  const b = await criarBancoDeTeste({ migrar: false });
  try {
    const [m] = lerMigracoes(PASTA_MIGRACOES);
    assert.ok(m);
    await migrar(b.dono, [m]);
    await assert.rejects(migrar(b.dono, [{ ...m, checksum: 'outro' }]), /mudou depois de aplicada/);
  } finally {
    await b.apagar();
  }
});

test('desfaz a migração inteira quando uma instrução falha', async () => {
  const b = await criarBancoDeTeste({ migrar: false });
  const pasta = mkdtempSync(join(tmpdir(), 'mig-'));
  try {
    writeFileSync(join(pasta, '0001_quebra.sql'), 'create table t (id int); select * from nao_existe;');
    await assert.rejects(migrar(b.dono, lerMigracoes(pasta)), /Falha na migração 0001_quebra/);
    const { rows } = await b.dono.query("select to_regclass('t') as t");
    assert.equal(rows[0].t, null);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
    await b.apagar();
  }
});

test('recusa nomes de arquivo fora do padrão', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'mig-'));
  try {
    writeFileSync(join(pasta, 'criar-tabela.sql'), 'select 1');
    assert.throws(() => lerMigracoes(pasta), /Nome de migração inválido/);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

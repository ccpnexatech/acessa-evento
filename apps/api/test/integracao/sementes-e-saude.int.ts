import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import { semear } from '../../src/shared/db/semeador.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { verificadorBanco } from '../../src/shared/db/verificador-banco.ts';

const SEMENTES = fileURLToPath(new URL('../../db/sementes', import.meta.url));

test('as sementes (COCAL 2026 e simulação vigente) são idempotentes e ficam visíveis', async () => {
  const b = await criarBancoDeTeste();
  const api = new Banco({ url: b.url, papel: 'app_api' });
  try {
    await semear(b.dono, SEMENTES);
    await semear(b.dono, SEMENTES);
    const eventos = await api.transacao({}, (tx) => tx.consultar<{ slug: string; tema: { cor_primaria: string } }>('select slug, tema from evento order by slug'));
    assert.deepEqual(eventos.map((e) => e.slug), ['cocal-2026', 'simulacao-2026']);
    assert.equal(eventos[0]?.tema.cor_primaria, '#0a5c69');
    // A simulação está vigente e tem sessões a partir de hoje, sem duplicar ao semear de novo.
    const [sim] = await api.transacao({}, (tx) => tx.consultar<{ atividades: number; hoje: number; tipos: number }>(
      `select (select count(*)::int from atividade a join evento e on e.id = a.evento_id where e.slug = 'simulacao-2026') as atividades,
              (select count(*)::int from atividade a join evento e on e.id = a.evento_id
                where e.slug = 'simulacao-2026' and (a.inicio at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date) as hoje,
              (select count(*)::int from tipo_ingresso t join evento e on e.id = t.evento_id where e.slug = 'simulacao-2026') as tipos`));
    assert.deepEqual(sim, { atividades: 4, hoje: 2, tipos: 3 });
  } finally {
    await api.fechar();
    await b.apagar();
  }
});

test('o verificador da /saude responde ok com o banco no ar e falha sem ele', async () => {
  const b = await criarBancoDeTeste({ migrar: false });
  const banco = new Banco({ url: b.url });
  try {
    assert.equal(await verificadorBanco(banco).verificar(), 'ok');
  } finally {
    await banco.fechar();
    await b.apagar();
  }
  const fora = new Banco({ url: 'postgres://ninguem@127.0.0.1:1/nada' });
  await assert.rejects(verificadorBanco(fora).verificar());
  await fora.fechar();
});

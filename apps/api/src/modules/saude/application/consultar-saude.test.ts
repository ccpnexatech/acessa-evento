import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsultarSaude } from './consultar-saude.ts';
import type { Relogio, VerificadorDependencia } from './ports.ts';

const relogioFixo = (inicio = 1_000_000): Relogio & { avancar(ms: number): void } => {
  let agora = inicio;
  return { agoraMs: () => agora, avancar: (ms) => { agora += ms; } };
};
const dep = (nome: string, verificar: VerificadorDependencia['verificar']): VerificadorDependencia => ({ nome, verificar });

test('sem dependências, o serviço está ok e informa versão e tempo ativo', async () => {
  const relogio = relogioFixo();
  const caso = new ConsultarSaude([], relogio, { versao: '0.1.0', iniciadoEmMs: 1_000_000 - 65_000, limiteMs: 100 });
  assert.deepEqual(await caso.executar(), { estado: 'ok', versao: '0.1.0', ativoHaSegundos: 65, dependencias: [] });
});

test('o estado geral é o pior entre as dependências', async () => {
  const caso = new ConsultarSaude(
    [dep('banco', async () => 'ok'), dep('email', async () => 'degradado')],
    relogioFixo(),
    { versao: 'x', iniciadoEmMs: 0, limiteMs: 100 },
  );
  const r = await caso.executar();
  assert.equal(r.estado, 'degradado');
  assert.deepEqual(r.dependencias.map((d) => [d.nome, d.estado]), [['banco', 'ok'], ['email', 'degradado']]);
});

test('uma dependência que lança erro vira falha sem derrubar o relatório', async () => {
  const caso = new ConsultarSaude(
    [dep('banco', async () => { throw new Error('conexão recusada'); })],
    relogioFixo(),
    { versao: 'x', iniciadoEmMs: 0, limiteMs: 100 },
  );
  const r = await caso.executar();
  assert.equal(r.estado, 'falha');
  assert.equal(r.dependencias[0]?.estado, 'falha');
});

test('uma dependência mais lenta que o limite conta como falha', async () => {
  const caso = new ConsultarSaude(
    [dep('lenta', () => new Promise((resolve) => setTimeout(() => resolve('ok'), 200)))],
    relogioFixo(),
    { versao: 'x', iniciadoEmMs: 0, limiteMs: 20 },
  );
  assert.equal((await caso.executar()).estado, 'falha');
});

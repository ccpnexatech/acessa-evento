import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { ErroDominio } from '../../../../shared/dominio/erro.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import type { FeiraServico } from '../../application/feira.ts';
import { registrarRotasFeira } from './rotas-feira.ts';

let servidor: Server;
let base: string;
const chamadas: [string, unknown[]][] = [];

before(async () => {
  const servico = new Proxy({}, {
    get: (_alvo, nome: string) => async (...args: unknown[]) => {
      chamadas.push([nome, args]);
      if (args.includes('ocupado')) throw new ErroDominio('conflito', 'Este estande acabou de ser reservado. Escolha outro.');
      return { ok: nome };
    },
  }) as FeiraServico;
  const r = new Roteador();
  const exigir = async (req: { cabecalhos: Readonly<Record<string, string | undefined>> }) => {
    if (!req.cabecalhos['authorization']) throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
    return { pessoaId: 'p1' };
  };
  registrarRotasFeira(r, servico, { exigir, opcional: async (req) => (req.cabecalhos['authorization'] ? exigir(req) : null) });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

const pedir = (metodo: string, caminho: string, corpo?: unknown, sessao = true) => fetch(`${base}${caminho}`, {
  method: metodo,
  headers: { ...(sessao ? { authorization: 'Bearer t' } : {}), ...(corpo === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});

test('cada rota chama o seu caso de uso, com o status certo e só com sessão', async () => {
  const EV = '/organizador/eventos/cocal-2026';
  const ROTAS: [string, string, number, string][] = [
    ['GET', `${EV}/feira`, 200, 'feira'],
    ['POST', `${EV}/montagens/pe1/analisar`, 204, 'analisarMontagem'],
    ['PATCH', `${EV}/pedidos-servico/s1`, 204, 'situacaoDoPedido'],
    ['GET', `${EV}/contratos`, 200, 'contratos'],
    ['POST', `${EV}/contratos`, 201, 'criarContrato'],
    ['PATCH', `${EV}/contratos/c1`, 204, 'alterarContrato'],
    ['POST', '/organizador/contratos/c1/enviar', 204, 'enviarContrato'],
    ['POST', '/organizador/contratos/c1/cancelar', 204, 'cancelarContrato'],
    ['POST', '/organizador/contratos/c1/registrar-assinatura', 204, 'assinarContrato'],
    ['GET', '/portal', 200, 'portal'],
    ['GET', '/portal/pe1', 200, 'participacao'],
    ['PUT', '/portal/pe1/estandes/e1', 204, 'reservar'],
    ['DELETE', '/portal/pe1/estandes/e1', 204, 'liberar'],
    ['PUT', '/portal/pe1/perfil', 204, 'salvarPerfil'],
    ['PUT', '/portal/pe1/servicos/s1', 200, 'pedirServico'],
    ['DELETE', '/portal/pe1/servicos/s1', 204, 'cancelarPedido'],
    ['PUT', '/portal/pe1/montagem', 200, 'salvarMontagem'],
    ['POST', '/portal/pe1/convites', 201, 'convidar'],
    ['POST', '/portal/pe1/credenciais', 201, 'emitirCredencial'],
    ['GET', '/contratos', 200, 'meusContratos'],
    ['POST', '/contratos/c1/assinar', 204, 'assinarContrato'],
  ];
  for (const [metodo, caminho, status, caso] of ROTAS) {
    chamadas.length = 0;
    const r = await pedir(metodo, caminho, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
    assert.equal(r.status, status, `${metodo} ${caminho}`);
    assert.deepEqual(chamadas.map(([n]) => n), [caso], `${metodo} ${caminho}`);
    assert.equal((await pedir(metodo, caminho, undefined, false)).status, 401);
  }
});

test('assinar no app vai sem protocolo; registrar assinatura exige protocolo', async () => {
  chamadas.length = 0;
  await pedir('POST', '/contratos/c1/assinar', {});
  await pedir('POST', '/organizador/contratos/c1/registrar-assinatura', { referencia: 'x' });
  assert.deepEqual(chamadas.map(([, a]) => a[3]), [false, true]);
});

test('lista de expositores é pública, com cache; logado, sem cache compartilhado; estande disputado vira 409', async () => {
  const anonimo = await pedir('GET', '/eventos/cocal-2026/expositores', undefined, false);
  assert.deepEqual([anonimo.status, anonimo.headers.get('cache-control')], [200, 'public, max-age=60']);
  assert.equal((await pedir('GET', '/eventos/cocal-2026/expositores')).headers.get('cache-control'), 'private, no-cache');
  assert.equal((await pedir('PUT', '/portal/pe1/estandes/ocupado', {})).status, 409);
});

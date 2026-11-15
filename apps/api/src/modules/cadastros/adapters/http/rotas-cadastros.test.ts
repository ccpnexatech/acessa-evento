import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Roteador } from '../../../../shared/http/roteador.ts';
import { criarServidor } from '../../../../shared/http/servidor.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import { ErroDominio } from '../../../../shared/dominio/erro.ts';
import { loggerSilencioso } from '../../../../shared/logger.ts';
import { CadastrosServico } from '../../application/cadastros.ts';
import { registrarRotasCadastros } from './rotas-cadastros.ts';

let servidor: Server;
let base: string;
const ID = '01900000-0000-7000-8000-000000000001';

before(async () => {
  const servico = new CadastrosServico({
    repositorio: {
      escopo: async (_p, tipo, ref) => (tipo === 'evento' && ref !== 'cocal-2026' ? null : ID),
      listar: async () => [{ id: ID, nome: 'Sala VIP' }],
      criar: async (pessoa, _n, _e, valores) => {
        if (pessoa !== 'admin') throw new ErroDominio('sem_permissao', 'Você não tem permissão para fazer isso.');
        if (valores['nome'] === 'Repetida') throw new ErroDominio('conflito', 'Já existe uma zona com esse nome neste evento.');
        return { id: ID, ...valores };
      },
      alterar: async (_p, _n, _e, id, valores) => ({ id, ...valores }),
      apagar: async (pessoa) => {
        if (pessoa !== 'admin') return false;
        return true;
      },
    },
    auditoria: { registrar: async () => undefined },
  });
  const r = new Roteador();
  registrarRotasCadastros(r, servico, {
    exigir: async (req) => {
      const [, quem] = (req.cabecalhos['authorization'] ?? '').split(' ');
      if (!quem) throw new ErroHttp(401, 'sessao_invalida', 'Entre de novo.');
      return { pessoaId: quem };
    },
    opcional: async () => null,
  });
  servidor = criarServidor({ roteador: r, logger: loggerSilencioso, corsOrigens: [], producao: false });
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((ok) => servidor.close(() => ok())));

const pedir = (metodo: string, caminho: string, corpo?: unknown, quem: string | null = 'admin') => fetch(`${base}${caminho}`, {
  method: metodo,
  headers: { ...(quem ? { authorization: `Bearer ${quem}` } : {}), ...(corpo === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});
const ZONAS = '/organizador/eventos/cocal-2026/zonas';

test('as quatro operações de um cadastro do evento, sem cache e só com sessão', async () => {
  assert.equal((await pedir('GET', ZONAS, undefined, null)).status, 401);
  const lista = await pedir('GET', ZONAS);
  assert.equal(lista.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await lista.json(), { itens: [{ id: ID, nome: 'Sala VIP' }] });
  const criada = await pedir('POST', ZONAS, { nome: 'Bastidores' });
  assert.equal(criada.status, 201);
  assert.deepEqual(await criada.json(), { id: ID, nome: 'Bastidores' });
  assert.equal((await pedir('PATCH', `${ZONAS}/${ID}`, { aberta: true })).status, 200);
  assert.equal((await pedir('DELETE', `${ZONAS}/${ID}`)).status, 204);
});

test('cada erro de domínio tem o seu status', async () => {
  assert.equal((await pedir('POST', ZONAS, {})).status, 422);
  assert.equal((await pedir('POST', ZONAS, { nome: 'Bastidores' }, 'participante')).status, 403);
  assert.equal((await pedir('POST', ZONAS, { nome: 'Repetida' })).status, 409);
  assert.equal((await pedir('GET', '/organizador/eventos/outro/zonas')).status, 404);
  assert.equal((await pedir('DELETE', `${ZONAS}/${ID}`, undefined, 'participante')).status, 404);
  const problema = await (await pedir('POST', ZONAS, { nome: '' })).json() as { codigo: string; titulo: string };
  assert.equal(problema.codigo, 'dados_invalidos');
  assert.match(problema.titulo, /Nome: preencha este campo/);
});

test('cadastro da organização vai pelo id dela; operação não oferecida não tem rota', async () => {
  assert.equal((await pedir('POST', `/organizador/organizacoes/${ID}/locais`, { nome: 'Centro de Eventos' })).status, 201);
  assert.equal((await pedir('GET', '/organizador/organizacoes/abc/locais')).status, 404);
  assert.equal((await pedir('PATCH', `/organizador/eventos/cocal-2026/parceiros-evento/${ID}`, { categoria: 'expositor' })).status, 405);
});

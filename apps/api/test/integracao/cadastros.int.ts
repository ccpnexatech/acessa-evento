/** Cadastros do organizador pela API, com Postgres real: a RLS decide e o erro do banco vira resposta legível (ADR 0029). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { subirApp } from '../apoio/app.ts';
import type { AppDeTeste } from '../apoio/app.ts';

let app: AppDeTeste;
let ana: string; // dona da organização A
let bia: string; // dona da organização B
let gil: string; // credenciamento em A
let orgA: string;
const EV = '/organizador/eventos/evento-a';
interface Item { id: string; [campo: string]: unknown }

before(async () => {
  app = await subirApp();
  ana = await app.entrar('ana@exemplo.com.br', 'Ana');
  bia = await app.entrar('bia@exemplo.com.br', 'Bia');
  gil = await app.entrar('gil@exemplo.com.br', 'Gil');
  const org = async (email: string, nome: string) => {
    const [o] = await app.dono<{ id: string }>('insert into organizacao (nome) values ($1) returning id', [nome]);
    await app.dono("insert into organizacao_membro (organizacao_id, pessoa_id, papel) values ($1, $2, 'dono')", [o?.id, await app.pessoaDe(email)]);
    return o?.id ?? '';
  };
  orgA = await org('ana@exemplo.com.br', 'Sociedade A');
  const orgB = await org('bia@exemplo.com.br', 'Sociedade B');
  const [a] = await app.dono<{ id: string }>("insert into evento (organizacao_id, slug, nome, inicio, fim, local) values ($1, 'evento-a', 'Evento A', '2027-03-01', '2027-03-03', 'Fortaleza') returning id", [orgA]);
  await app.dono("insert into evento (organizacao_id, slug, nome, inicio, fim, local, publicado) values ($1, 'evento-b', 'Evento B', '2027-03-01', '2027-03-03', 'Recife', true)", [orgB]);
  await app.dono("insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'credenciamento')", [a?.id, await app.pessoaDe('gil@exemplo.com.br')]);
});
after(() => app.fechar());

test('zona: cria, lista em ordem, altera, recusa nome repetido e apaga', async () => {
  const vip = await app.pedir<Item>('POST', `${EV}/zonas`, ana, { nome: 'Sala VIP', ordem: 2 });
  assert.equal(vip.status, 201);
  assert.deepEqual({ ...vip.corpo, id: '' }, { id: '', nome: 'Sala VIP', descricao: null, aberta: false, rotaAcessivel: null, ordem: 2 });
  await app.pedir('POST', `${EV}/zonas`, ana, { nome: 'Área geral', aberta: true, ordem: 1 });
  const lista = await app.pedir<{ itens: Item[] }>('GET', `${EV}/zonas`, ana);
  assert.deepEqual(lista.corpo.itens.map((z) => z['nome']), ['Área geral', 'Sala VIP']);
  const repetida = await app.pedir<{ codigo: string; titulo: string }>('POST', `${EV}/zonas`, ana, { nome: 'Sala VIP' });
  assert.deepEqual([repetida.status, repetida.corpo.titulo], [409, 'Já existe uma zona com esse nome neste evento.']);
  const alterada = await app.pedir<Item>('PATCH', `${EV}/zonas/${vip.corpo.id}`, ana, { rotaAcessivel: 'Elevador ao lado da recepção' });
  assert.equal(alterada.corpo['rotaAcessivel'], 'Elevador ao lado da recepção');
  assert.equal((await app.pedir('DELETE', `${EV}/zonas/${vip.corpo.id}`, ana)).status, 204);
  assert.equal((await app.pedir('DELETE', `${EV}/zonas/${vip.corpo.id}`, ana)).status, 404);
});

test('quem não tem o papel recebe 403 ao criar e 404 ao alterar; a outra organização nem vê o rascunho', async () => {
  const semPapel = await app.pedir<{ codigo: string }>('POST', `${EV}/zonas`, gil, { nome: 'Do portão' });
  assert.deepEqual([semPapel.status, semPapel.corpo.codigo], [403, 'sem_permissao']);
  const { corpo: { itens: [geral] } } = await app.pedir<{ itens: Item[] }>('GET', `${EV}/zonas`, gil);
  assert.equal((await app.pedir('PATCH', `${EV}/zonas/${geral?.id}`, gil, { aberta: false })).status, 404);
  assert.equal((await app.pedir('GET', `${EV}/zonas`, bia)).status, 404);
  assert.equal((await app.pedir('POST', `${EV}/zonas`, bia, { nome: 'Invasora' })).status, 404);
  assert.equal((await app.pedir('GET', `${EV}/zonas`)).status, 401);
  // Evento publicado da vizinha: a dona de A enxerga o mapa, mas não escreve nele.
  assert.equal((await app.pedir('GET', '/organizador/eventos/evento-b/zonas', ana)).status, 200);
  assert.equal((await app.pedir('POST', '/organizador/eventos/evento-b/zonas', ana, { nome: 'Invasora' })).status, 403);
});

test('referência a item de outro evento e regra de tabela viram 422 com frase legível', async () => {
  const [zonaB] = await app.dono<{ id: string }>("insert into zona (evento_id, nome) select id, 'Zona B' from evento where slug = 'evento-b' returning id");
  const sala = await app.pedir<{ titulo: string }>('POST', `${EV}/salas`, ana, { nome: 'Auditório', local: 'Térreo', zonaId: zonaB?.id });
  assert.deepEqual([sala.status, sala.corpo.titulo], [422, 'Um dos itens escolhidos não existe neste evento.']);
  const atividade = await app.pedir<{ titulo: string }>('POST', `${EV}/atividades`, ana, { titulo: 'Abertura', inicio: '2027-03-01T12:00:00Z', fim: '2027-03-01T11:00:00Z' });
  assert.deepEqual([atividade.status, atividade.corpo.titulo], [422, 'O fim da atividade precisa ser depois do início.']);
});

test('tipos de formato estável: decimal, data, lista e colunas só de leitura', async () => {
  const tipo = await app.pedir<Item>('POST', `${EV}/tipos-estande`, ana, { nome: 'Linha 3x3', larguraM: 3, profundidadeM: 2.5, precoCentavos: 600000 });
  assert.deepEqual([tipo.corpo['larguraM'], tipo.corpo['profundidadeM']], [3, 2.5]);
  const servico = await app.pedir<Item>('POST', `${EV}/servicos-feira`, ana, { nome: 'Energia', unidade: 'kVA', precoCentavos: 25000, prazo: '2027-02-15' });
  assert.equal(servico.corpo['prazo'], '2027-02-15');
  const aviso = await app.pedir<Item>('POST', `${EV}/avisos`, ana, { titulo: 'Bem-vindos', corpo: 'O credenciamento abre às 7h.', categorias: ['palestrante', 'expositor'] });
  assert.deepEqual(aviso.corpo['categorias'], ['palestrante', 'expositor']);
  const ingresso = await app.pedir<Item>('POST', `${EV}/tipos-ingresso`, ana, { nome: 'Meia', precoCentavos: 5000, vagas: 40, modalidade: 'meia' });
  assert.deepEqual([ingresso.corpo['ocupadas'], ingresso.corpo['modalidade'], ingresso.corpo['publicoVeSaldo']], [0, 'meia', true]);
  const planta = await app.pedir<Item>('POST', `${EV}/plantas`, ana, { nome: 'Pavilhão', colunas: 10, linhas: 6 });
  const estande = await app.pedir<Item>('POST', `${EV}/estandes`, ana, { plantaId: planta.corpo.id, tipoEstandeId: tipo.corpo.id, codigo: 'a1', coluna: 1, linha: 1 });
  assert.deepEqual([estande.corpo['codigo'], estande.corpo['situacao'], estande.corpo['valorCentavos']], ['A1', 'livre', null]);
  // Situação do estande não se escreve por aqui.
  assert.equal((await app.pedir('PATCH', `${EV}/estandes/${estande.corpo.id}`, ana, { situacao: 'vendido' })).status, 422);
  const emUso = await app.pedir<{ titulo: string }>('DELETE', `${EV}/tipos-estande/${tipo.corpo.id}`, ana);
  assert.deepEqual([emUso.status, emUso.corpo.titulo], [409, 'Não dá para apagar: há outros registros ligados a este.']);
});

test('cadastros da organização: local e parceiro com CNPJ conferido; a vizinha não entra', async () => {
  const ORG = `/organizador/organizacoes/${orgA}`;
  const local = await app.pedir<Item>('POST', `${ORG}/locais`, ana, { nome: 'Centro de Eventos', cidade: 'Fortaleza', uf: 'ce' });
  assert.deepEqual([local.status, local.corpo['uf']], [201, 'CE']);
  const parceiro = await app.pedir<Item>('POST', `${ORG}/parceiros`, ana, { razaoSocial: 'Xis Equipamentos Ltda', cnpj: '11.222.333/0001-81' });
  assert.equal(parceiro.corpo['cnpj'], '11222333000181');
  assert.equal((await app.pedir('POST', `${ORG}/parceiros`, ana, { razaoSocial: 'Outra', cnpj: '11.222.333/0001-81' })).status, 409);
  assert.equal((await app.pedir('POST', `${ORG}/parceiros`, ana, { razaoSocial: 'Errada', cnpj: '11.222.333/0001-80' })).status, 422);
  assert.equal((await app.pedir('GET', `${ORG}/locais`, bia)).status, 404);
  // Gil é da equipe de um evento: enxerga a organização, mas não cadastra nela.
  assert.equal((await app.pedir('POST', `${ORG}/locais`, gil, { nome: 'Sem papel' })).status, 403);
  const naFeira = await app.pedir<Item>('POST', `${EV}/parceiros-evento`, ana, { parceiroId: parceiro.corpo.id });
  assert.deepEqual([naFeira.status, naFeira.corpo['categoria'], naFeira.corpo['situacao']], [201, 'expositor', 'convidado']);
});

test('toda escrita fica na auditoria, sem o conteúdo', async () => {
  const linhas = await app.dono<{ acao: string; dados: Record<string, unknown> }>("select acao, dados from auditoria where acao like 'cadastro.%' order by id");
  assert.ok(linhas.some((l) => l.acao === 'cadastro.zonas.apagar'));
  assert.ok(linhas.some((l) => l.acao === 'cadastro.avisos.criar'));
  assert.ok(linhas.every((l) => !JSON.stringify(l.dados).includes('credenciamento abre')));
});

/** Feature 07 pela API com Postgres real: do primeiro acesso do organizador à equipe montada por convite. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { subirApp } from '../apoio/app.ts';
import type { AppDeTeste } from '../apoio/app.ts';

let app: AppDeTeste;
let ana: string;
let bia: string;
let caio: string;
let vizinha: string;
let orgA: string;
let idBia: string;
const EV = '/organizador/eventos/jornada-2027';
interface Inicio { organizacoes: { id: string; nome: string; papeis: string[] }[]; eventos: { slug: string; papeis: string[] }[]; convites: { id: string; evento: string | null; papeis: string[] }[] }
interface Evento { evento: { nome: string; papeis: string[]; publicado: boolean; tema: Record<string, string>; demonstracao: boolean }; prontidao: { item: string; feito: boolean }[]; numeros: Record<string, number> }
interface Equipe { membros: { pessoaId: string; nome: string; papeis: string[]; cargo: string | null }[]; convites: { id: string; email: string; situacao: string }[]; papeis: unknown[] }

before(async () => {
  app = await subirApp();
  ana = await app.entrar('ana@exemplo.com.br', 'Ana');
  bia = await app.entrar('bia@exemplo.com.br', 'Bia');
  caio = await app.entrar('caio@exemplo.com.br', 'Caio');
  vizinha = await app.entrar('vizinha@exemplo.com.br', 'Vizinha');
  idBia = await app.pessoaDe('bia@exemplo.com.br');
});
after(() => app.fechar());

test('primeiro acesso: cria a organização, vira dona e cria o evento em rascunho', async () => {
  assert.deepEqual((await app.pedir<Inicio>('GET', '/organizador/inicio', ana)).corpo, { organizacoes: [], eventos: [], convites: [] });
  const org = await app.pedir<{ id: string }>('POST', '/organizador/organizacoes', ana, { nome: 'Sociedade Cearense de Anestesiologia' });
  assert.equal(org.status, 201);
  orgA = org.corpo.id;
  const evento = await app.pedir<{ slug: string }>('POST', `/organizador/organizacoes/${orgA}/eventos`, ana,
    { nome: 'Jornada 2027', slug: 'jornada-2027', inicio: '2027-03-01', fim: '2027-03-03', local: 'Fortaleza' });
  assert.deepEqual([evento.status, evento.corpo.slug], [201, 'jornada-2027']);
  const repetido = await app.pedir<{ titulo: string }>('POST', `/organizador/organizacoes/${orgA}/eventos`, ana,
    { nome: 'Outra', slug: 'jornada-2027', inicio: '2027-03-01', fim: '2027-03-03', local: 'Fortaleza' });
  assert.deepEqual([repetido.status, repetido.corpo.titulo], [409, 'Endereço do evento: já está em uso. Escolha outro.']);
  const inicio = (await app.pedir<Inicio>('GET', '/organizador/inicio', ana)).corpo;
  assert.deepEqual(inicio.organizacoes.map((o) => o.papeis), [['dono']]);
  assert.deepEqual(inicio.eventos.map((e) => [e.slug, e.papeis]), [['jornada-2027', ['dono']]]);
  // Quem não é da organização não cria evento nela.
  assert.equal((await app.pedir('POST', `/organizador/organizacoes/${orgA}/eventos`, vizinha,
    { nome: 'Invasor', slug: 'invasor', inicio: '2027-03-01', fim: '2027-03-03', local: 'X' })).status, 403);
});

test('início do evento: checklist de prontidão começa vazio e acompanha o que é feito', async () => {
  const antes = (await app.pedir<Evento>('GET', EV, ana)).corpo;
  assert.deepEqual(antes.prontidao.filter((p) => p.feito).map((p) => p.item), []);
  assert.equal(antes.prontidao.length, 9);
  const local = await app.pedir<{ id: string }>('POST', `/organizador/organizacoes/${orgA}/locais`, ana, { nome: 'Centro de Eventos' });
  await app.pedir('POST', `${EV}/zonas`, ana, { nome: 'Área geral', aberta: true });
  await app.pedir('POST', `${EV}/pontos-leitura`, ana, { nome: 'Portão 1' });
  const alterar = await app.pedir('PATCH', EV, ana, {
    localId: local.corpo.id, recursosOferecidos: ['libras', 'acesso_sem_degraus'], publicado: true,
    tema: { corPrimaria: 'petroleo', corDestaque: 'laranja', fonte: 'legivel', arredondamento: 'suave' },
  });
  assert.equal(alterar.status, 204);
  const depois = (await app.pedir<Evento>('GET', EV, ana)).corpo;
  assert.deepEqual(depois.prontidao.filter((p) => p.feito).map((p) => p.item), ['local', 'acessibilidade', 'zonas', 'pontos_leitura', 'publicado']);
  assert.deepEqual(depois.evento.tema, { cor_primaria: 'petroleo', cor_destaque: 'laranja', fonte: 'legivel', arredondamento: 'suave' });
  assert.deepEqual([depois.numeros['inscritos'], depois.numeros['entradas']], [0, 0]);
  // Cor fora da paleta não entra; local de outra organização também não.
  assert.equal((await app.pedir('PATCH', EV, ana, { tema: { corPrimaria: '#123456', corDestaque: 'azul', fonte: 'padrao', arredondamento: 'reto' } })).status, 422);
  const [orgB] = await app.dono<{ id: string }>("insert into organizacao (nome) values ('Sociedade B') returning id");
  const [localB] = await app.dono<{ id: string }>("insert into local (organizacao_id, nome) values ($1, 'Local B') returning id", [orgB?.id]);
  const trocado = await app.pedir<{ titulo: string }>('PATCH', EV, ana, { localId: localB?.id });
  assert.deepEqual([trocado.status, trocado.corpo.titulo], [409, 'O local não pertence à organização deste evento.']);
});

test('convite: só a convidada vê e aceita; os papéis entram de uma vez', async () => {
  const convite = await app.pedir<{ id: string }>('POST', `${EV}/convites`, ana, { email: 'Bia@exemplo.com.br', papeis: ['credenciamento', 'acessibilidade'] });
  assert.equal(convite.status, 201);
  assert.deepEqual(app.emails.map((e) => [e.para, e.assunto]), [['bia@exemplo.com.br', 'Convite para a equipe: Jornada 2027']]);
  assert.deepEqual((await app.pedir<{ convites: unknown[] }>('GET', '/convites', caio)).corpo.convites, []);
  assert.equal((await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, caio)).status, 409);
  const pendentes = (await app.pedir<Inicio>('GET', '/organizador/inicio', bia)).corpo.convites;
  assert.deepEqual(pendentes.map((c) => [c.evento, c.papeis]), [['Jornada 2027', ['credenciamento', 'acessibilidade']]]);
  assert.equal((await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, bia)).status, 204);
  assert.equal((await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, bia)).status, 409);
  const equipe = (await app.pedir<Equipe>('GET', `${EV}/equipe`, ana)).corpo;
  assert.deepEqual(equipe.membros.map((m) => [m.nome, m.papeis]), [['Bia', ['acessibilidade', 'credenciamento']]]);
  assert.deepEqual(equipe.convites.map((c) => [c.email, c.situacao]), [['bia@exemplo.com.br', 'aceito']]);
  assert.equal(equipe.papeis.length, 8);
});

test('convite cancelado não vale; quem não é admin não convida nem vê os convites', async () => {
  const convite = await app.pedir<{ id: string }>('POST', `${EV}/convites`, ana, { email: 'caio@exemplo.com.br', papeis: ['conteudo'] });
  assert.equal((await app.pedir('DELETE', `/organizador/convites/${convite.corpo.id}`, bia)).status, 404);
  assert.equal((await app.pedir('DELETE', `/organizador/convites/${convite.corpo.id}`, ana)).status, 204);
  const aceite = await app.pedir<{ titulo: string }>('POST', `/convites/${convite.corpo.id}/aceitar`, caio);
  assert.deepEqual([aceite.status, aceite.corpo.titulo], [409, 'Este convite não vale mais. Peça um novo a quem convidou.']);
  assert.equal((await app.pedir('POST', `${EV}/convites`, bia, { email: 'caio@exemplo.com.br', papeis: ['conteudo'] })).status, 403);
  assert.deepEqual((await app.pedir<Equipe>('GET', `${EV}/equipe`, bia)).corpo.convites, []);
  // Para quem é de fora, a área do organizador de um evento alheio simplesmente não existe.
  assert.equal((await app.pedir('POST', `${EV}/convites`, vizinha, { email: 'x@exemplo.com.br', papeis: ['admin'] })).status, 404);
});

test('equipe: admin acumula papéis de alguém, põe na mesa organizadora e remove', async () => {
  assert.equal((await app.pedir('PUT', `${EV}/equipe/${idBia}`, ana, { papeis: ['conteudo', 'operacao'], cargo: 'Coordenação científica', exibirPublico: true })).status, 204);
  const equipe = (await app.pedir<Equipe>('GET', `${EV}/equipe`, bia)).corpo;
  assert.deepEqual(equipe.membros.map((m) => [m.papeis, m.cargo]), [[['conteudo', 'operacao'], 'Coordenação científica']]);
  assert.deepEqual(await app.dono('select * from mesa_organizadora((select id from evento where slug = $1))', ['jornada-2027']), [{ nome: 'Bia', cargo: 'Coordenação científica' }]);
  // Bia agora monta zonas (operação), mas não mexe na equipe nem nos dados do evento.
  assert.equal((await app.pedir('POST', `${EV}/zonas`, bia, { nome: 'Bastidores' })).status, 201);
  assert.equal((await app.pedir('PUT', `${EV}/equipe/${idBia}`, bia, { papeis: ['admin'] })).status, 403);
  assert.equal((await app.pedir('PATCH', EV, bia, { publicado: false })).status, 403);
  assert.equal((await app.pedir('DELETE', `${EV}/equipe/${idBia}`, ana)).status, 204);
  assert.equal((await app.pedir('GET', `${EV}/equipe`, bia)).status, 404);
});

test('convite de organização: só a dona convida; a admin aceita e enxerga todos os eventos', async () => {
  const convite = await app.pedir<{ id: string }>('POST', `/organizador/organizacoes/${orgA}/convites`, ana, { email: 'caio@exemplo.com.br', papeis: ['admin'] });
  assert.equal(convite.status, 201);
  assert.equal((await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, caio)).status, 204);
  const inicio = (await app.pedir<Inicio>('GET', '/organizador/inicio', caio)).corpo;
  assert.deepEqual(inicio.eventos.map((e) => [e.slug, e.papeis]), [['jornada-2027', ['admin']]]);
  assert.equal((await app.pedir('POST', `/organizador/organizacoes/${orgA}/convites`, caio, { email: 'x@exemplo.com.br', papeis: ['admin'] })).status, 403);
  assert.equal((await app.pedir('POST', `/organizador/organizacoes/${orgA}/convites`, vizinha, { email: 'x@exemplo.com.br', papeis: ['admin'] })).status, 404);
});

test('evento de demonstração: a equipe trabalha nele e ele não aparece na lista pública', async () => {
  await app.pedir('POST', `/organizador/organizacoes/${orgA}/eventos`, ana, { nome: 'Demonstração', slug: 'demonstracao-a', inicio: '2027-01-01', fim: '2027-01-02', local: 'Fortaleza', demonstracao: true });
  await app.pedir('PATCH', '/organizador/eventos/demonstracao-a', ana, { publicado: true, inscricoesAbertas: true });
  const publicos = (await app.pedir<{ eventos: { slug: string }[] }>('GET', '/eventos')).corpo.eventos.map((e) => e.slug);
  assert.deepEqual(publicos, ['jornada-2027']);
  assert.equal((await app.pedir<Evento>('GET', '/organizador/eventos/demonstracao-a', ana)).corpo.evento.demonstracao, true);
  assert.equal((await app.pedir('GET', '/organizador/eventos/demonstracao-a', vizinha)).status, 404);
  assert.equal((await app.pedir('GET', EV, vizinha)).status, 404);
});

test('auditoria registra as ações sem guardar e-mail de convidado', async () => {
  const linhas = await app.dono<{ acao: string; dados: unknown }>("select acao, dados from auditoria where acao ~ '^(organizacao|evento|equipe|convite)\\.'");
  const acoes = new Set(linhas.map((l) => l.acao));
  for (const a of ['organizacao.criar', 'evento.criar', 'evento.publicar', 'convite.criar', 'convite.aceitar', 'convite.revogar', 'equipe.definir', 'equipe.remover']) assert.ok(acoes.has(a), a);
  assert.ok(!JSON.stringify(linhas).includes('@exemplo'));
});

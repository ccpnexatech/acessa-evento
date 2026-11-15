/** Feature 10 pela API com Postgres real: o momento "Entrou um expositor", do convite à credencial, com um vizinho que não enxerga nada. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { subirApp } from '../apoio/app.ts';
import type { AppDeTeste } from '../apoio/app.ts';

let app: AppDeTeste;
let ana: string;   // dona da organização
let rui: string;   // responsável da Xis Med
let tina: string;  // equipe da Xis Med
let sol: string;   // responsável da Ypsilon
let fulano: string;
const ids = {} as Record<'org' | 'peX' | 'peY' | 'a1' | 'a2' | 'ilha' | 'energia' | 'contrato' | 'modelo', string>;
const EV = '/organizador/eventos/jornada-2027';
interface Portal {
  participacao: { parceiro: string; papel: string | null; situacao: string };
  resumo: { estandes: number; investimentoCentavos: number; nivel: string | null; credenciaisDireito: number; proximoNivel: { nome: string; faltamCentavos: number } | null };
  estandes: { codigo: string; situacao: string }[]; pedidos: { servico: string; valorCentavos: number; situacao: string; id: string }[];
  montagem: { situacao: string } | null; equipe: { pessoaId: string; nome: string; papel: string; credencialId: string | null }[];
  contratos: { id: string; situacao: string; corpo: string }[]; pendencias: string[];
}

before(async () => {
  app = await subirApp();
  ana = await app.entrar('ana@exemplo.com.br', 'Ana');
  rui = await app.entrar('rui@exemplo.com.br', 'Rui');
  tina = await app.entrar('tina@exemplo.com.br', 'Tina');
  sol = await app.entrar('sol@exemplo.com.br', 'Sol');
  fulano = await app.entrar('fulano@exemplo.com.br', 'Fulano');
  ids.org = (await app.pedir<{ id: string }>('POST', '/organizador/organizacoes', ana, { nome: 'Sociedade A' })).corpo.id;
  // Evento ainda em rascunho: o expositor é convidado antes da publicação.
  await app.pedir('POST', `/organizador/organizacoes/${ids.org}/eventos`, ana, { nome: 'Jornada 2027', slug: 'jornada-2027', inicio: '2027-03-01', fim: '2027-03-03', local: 'Fortaleza' });
  const criar = async (caminho: string, corpo: unknown) => (await app.pedir<{ id: string }>('POST', caminho, ana, corpo)).corpo.id;
  const planta = await criar(`${EV}/plantas`, { nome: 'Pavilhão', colunas: 10, linhas: 6 });
  const linha = await criar(`${EV}/tipos-estande`, { nome: 'Linha 3x3', larguraM: 3, profundidadeM: 3, precoCentavos: 600000 });
  const ilha = await criar(`${EV}/tipos-estande`, { nome: 'Ilha 6x6', larguraM: 6, profundidadeM: 6, precoCentavos: 3000000 });
  ids.a1 = await criar(`${EV}/estandes`, { plantaId: planta, tipoEstandeId: linha, codigo: 'A1', coluna: 1, linha: 1 });
  ids.a2 = await criar(`${EV}/estandes`, { plantaId: planta, tipoEstandeId: linha, codigo: 'A2', coluna: 2, linha: 1 });
  ids.ilha = await criar(`${EV}/estandes`, { plantaId: planta, tipoEstandeId: ilha, codigo: 'I1', coluna: 5, linha: 3 });
  for (const [nome, minimo] of [['Bronze', 0], ['Prata', 1000000], ['Ouro', 3000000]] as const) {
    await criar(`${EV}/niveis-expositor`, { nome, investimentoMinimoCentavos: minimo });
  }
  ids.energia = await criar(`${EV}/servicos-feira`, { nome: 'Energia', unidade: 'kVA', precoCentavos: 25000, prazo: '2099-01-01' });
  ids.modelo = await criar(`/organizador/organizacoes/${ids.org}/modelos-contrato`, { nome: 'Cessão de espaço', corpo: 'Contrato de cessão de espaço na feira do evento. Cláusula única.' });
  const x = await criar(`/organizador/organizacoes/${ids.org}/parceiros`, { razaoSocial: 'Xis Equipamentos Ltda', nomeFantasia: 'Xis Med' });
  const y = await criar(`/organizador/organizacoes/${ids.org}/parceiros`, { razaoSocial: 'Ypsilon Farma S.A.' });
  ids.peX = await criar(`${EV}/parceiros-evento`, { parceiroId: x });
  ids.peY = await criar(`${EV}/parceiros-evento`, { parceiroId: y });
});
after(() => app.fechar());

const portal = async (token: string, id = ids.peX) => (await app.pedir<Portal>('GET', `/portal/${id}`, token)).corpo;

test('a organização convida o responsável, que entra no portal mesmo com o evento em rascunho', async () => {
  for (const [pe, email, token] of [[ids.peX, 'rui@exemplo.com.br', rui], [ids.peY, 'sol@exemplo.com.br', sol]] as const) {
    const convite = await app.pedir<{ id: string }>('POST', `/portal/${pe}/convites`, ana, { email, papel: 'responsavel' });
    assert.equal(convite.status, 201);
    assert.equal((await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, token)).status, 204);
  }
  assert.equal(app.emails.at(-2)?.assunto, 'Convite para a equipe: Xis Med no evento Jornada 2027');
  const { corpo } = await app.pedir<{ participacoes: { parceiro: string; papel: string }[] }>('GET', '/portal', rui);
  assert.deepEqual(corpo.participacoes.map((p) => [p.parceiro, p.papel]), [['Xis Med', 'responsavel']]);
  const inicio = await portal(rui);
  assert.deepEqual(inicio.pendencias, ['Escolha seu estande no mapa.', 'Monte a sua marca no app.', 'Informe como será a montagem.', 'Aguarde o contrato da organização.']);
  // O mapa da feira aparece para o parceiro em rascunho; para quem é de fora, o evento não existe.
  const mapa = await app.pedir<{ estandes: { codigo: string; situacao: string; precoCentavos: number }[] }>('GET', '/eventos/jornada-2027/expositores', rui);
  assert.deepEqual(mapa.corpo.estandes.map((e) => [e.codigo, e.situacao]), [['A1', 'livre'], ['A2', 'livre'], ['I1', 'livre']]);
  assert.equal((await app.pedir('GET', '/eventos/jornada-2027/expositores', fulano)).status, 404);
  assert.equal((await app.pedir('GET', '/eventos/jornada-2027/expositores')).status, 404);
});

test('escolher estande no mapa: só um leva, e o resumo mostra quanto falta para o próximo nível', async () => {
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/estandes/${ids.a1}`, rui)).status, 204);
  const perdeu = await app.pedir<{ titulo: string }>('PUT', `/portal/${ids.peY}/estandes/${ids.a1}`, sol);
  assert.deepEqual([perdeu.status, perdeu.corpo.titulo], [409, 'Este estande acabou de ser reservado. Escolha outro.']);
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/estandes/${ids.ilha}`, rui)).status, 204);
  // A Sol não reserva nem libera em nome do vizinho.
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/estandes/${ids.a2}`, sol)).status, 404);
  assert.equal((await app.pedir('DELETE', `/portal/${ids.peY}/estandes/${ids.a1}`, sol)).status, 409);
  const p = await portal(rui);
  assert.deepEqual(p.estandes.map((e) => [e.codigo, e.situacao]), [['A1', 'reservado'], ['I1', 'reservado']]);
  // Reservado ainda não conta para o nível: só o que foi vendido.
  assert.deepEqual([p.resumo.estandes, p.resumo.nivel, p.resumo.proximoNivel], [0, null, { nome: 'Prata', faltamCentavos: 1000000 }]);
});

test('marca, serviços e montagem pelo portal; a equipe só enxerga', async () => {
  const semDescricao = await app.pedir<{ titulo: string }>('PUT', `/portal/${ids.peX}/perfil`, rui, { nomeExibicao: 'Xis Med', logoUrl: 'https://exemplo.com.br/x.png' });
  assert.deepEqual([semDescricao.status, semDescricao.corpo.titulo], [422, 'Descrição do logo: descreva o logo para quem usa leitor de tela.']);
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/perfil`, rui, { nomeExibicao: 'Xis Med', logoUrl: 'https://exemplo.com.br/x.png', logoDescricao: 'Letra X azul', frase: 'Monitores para anestesia', publicado: true })).status, 204);
  const pedido = await app.pedir<{ valorCentavos: number }>('PUT', `/portal/${ids.peX}/servicos/${ids.energia}`, rui, { quantidade: 4 });
  assert.deepEqual([pedido.status, pedido.corpo.valorCentavos], [200, 100000]);
  const montagem = await app.pedir<{ situacao: string }>('PUT', `/portal/${ids.peX}/montagem`, rui, { tipo: 'montadora_propria', montadora: 'Monta Bem', projetoUrl: 'https://exemplo.com.br/p.pdf', artRrt: 'ART 123456', termoAceito: true });
  assert.equal(montagem.corpo.situacao, 'em_analise');
  // O responsável convida a própria equipe; ela vê o portal, mas não altera nem convida.
  const convite = await app.pedir<{ id: string }>('POST', `/portal/${ids.peX}/convites`, rui, { email: 'tina@exemplo.com.br' });
  assert.equal((await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, tina)).status, 204);
  assert.equal((await portal(tina)).participacao.papel, 'equipe');
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/perfil`, tina, { nomeExibicao: 'Pela equipe' })).status, 403);
  assert.equal((await app.pedir('POST', `/portal/${ids.peX}/convites`, tina, { email: 'outro@exemplo.com.br' })).status, 403);
  assert.equal((await app.pedir('POST', `/portal/${ids.peX}/convites`, rui, { email: 'outro@exemplo.com.br', papel: 'responsavel' })).status, 403);
  // A organização analisa a montagem e confirma o serviço; o parceiro não aprova a si mesmo.
  assert.equal((await app.pedir('POST', `${EV}/montagens/${ids.peX}/analisar`, rui, { aprovar: true })).status, 404);
  assert.equal((await app.pedir('POST', `${EV}/montagens/${ids.peX}/analisar`, ana, { aprovar: true })).status, 204);
  const { pedidos: [energia] } = await portal(rui);
  assert.equal((await app.pedir('PATCH', `${EV}/pedidos-servico/${energia?.id}`, ana, { situacao: 'confirmado' })).status, 204);
  const confirmado = await app.pedir<{ titulo: string }>('PUT', `/portal/${ids.peX}/servicos/${ids.energia}`, rui, { quantidade: 1 });
  assert.deepEqual([confirmado.status, confirmado.corpo.titulo], [403, 'Pedido já confirmado ou cancelado.']);
});

test('um expositor não enxerga o outro', async () => {
  assert.equal((await app.pedir('GET', `/portal/${ids.peX}`, sol)).status, 404);
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/perfil`, sol, { nomeExibicao: 'Tomado' })).status, 404);
  assert.equal((await app.pedir('PUT', `/portal/${ids.peX}/servicos/${ids.energia}`, sol, { quantidade: 1 })).status, 404);
  assert.equal((await app.pedir('GET', `/portal/${ids.peX}`, fulano)).status, 404);
  assert.deepEqual((await app.pedir<{ participacoes: unknown[] }>('GET', '/portal', fulano)).corpo.participacoes, []);
  assert.equal((await app.pedir('GET', `${EV}/feira`, rui)).status, 404);
});

test('contrato: do modelo ao aceite no app; assinar liga estandes, nível e credenciais', async () => {
  const criado = await app.pedir<{ id: string }>('POST', `${EV}/contratos`, ana, { parceiroEventoId: ids.peX, modeloContratoId: ids.modelo, valorCentavos: 3600000 });
  assert.equal(criado.status, 201);
  ids.contrato = criado.corpo.id;
  // Rascunho o parceiro não vê; credencial antes da assinatura não sai.
  assert.deepEqual((await portal(rui)).contratos, []);
  const cedo = await app.pedir<{ titulo: string }>('POST', `/portal/${ids.peX}/credenciais`, rui, { pessoaId: await app.pessoaDe('tina@exemplo.com.br') });
  assert.deepEqual([cedo.status, cedo.corpo.titulo], [409, 'Contrato ainda não assinado.']);
  assert.equal((await app.pedir('POST', `/contratos/${ids.contrato}/assinar`, rui)).status, 409);
  assert.equal((await app.pedir('POST', `/organizador/contratos/${ids.contrato}/enviar`, rui)).status, 409);
  assert.equal((await app.pedir('POST', `/organizador/contratos/${ids.contrato}/enviar`, ana)).status, 204);
  const mudou = await app.pedir<{ titulo: string }>('PATCH', `${EV}/contratos/${ids.contrato}`, ana, { corpo: 'Contrato com uma cláusula nova, escondida.' });
  assert.deepEqual([mudou.status, mudou.corpo.titulo], [409, 'Contrato enviado não pode ser alterado.']);
  const meus = await app.pedir<{ contratos: { id: string; corpo: string; situacao: string }[] }>('GET', '/contratos', rui);
  assert.deepEqual(meus.corpo.contratos.map((c) => [c.id, c.situacao]), [[ids.contrato, 'enviado']]);
  assert.match(meus.corpo.contratos[0]?.corpo ?? '', /cessão de espaço/);
  assert.deepEqual((await portal(rui)).pendencias, ['Leia e assine o contrato.']);
  // Equipe, vizinho e a própria organização não assinam o aceite de quem contrata.
  for (const token of [tina, sol, ana]) assert.equal((await app.pedir('POST', `/contratos/${ids.contrato}/assinar`, token)).status, 403);
  assert.deepEqual((await app.pedir<{ contratos: unknown[] }>('GET', '/contratos', tina)).corpo.contratos, []);
  assert.equal((await app.pedir('POST', `/contratos/${ids.contrato}/assinar`, rui)).status, 204);

  const p = await portal(rui);
  assert.deepEqual(p.estandes.map((e) => e.situacao), ['vendido', 'vendido']);
  assert.deepEqual([p.participacao.situacao, p.resumo.nivel, p.resumo.investimentoCentavos, p.resumo.credenciaisDireito, p.resumo.proximoNivel], ['ativo', 'Ouro', 3600000, 15, null]);
  assert.deepEqual(p.pendencias, []);
  const credencial = await app.pedir<{ id: string }>('POST', `/portal/${ids.peX}/credenciais`, rui, { pessoaId: await app.pessoaDe('tina@exemplo.com.br') });
  assert.equal(credencial.status, 201);
  const fora = await app.pedir<{ titulo: string }>('POST', `/portal/${ids.peX}/credenciais`, rui, { pessoaId: await app.pessoaDe('fulano@exemplo.com.br') });
  assert.deepEqual([fora.status, fora.corpo.titulo], [409, 'A pessoa não é da equipe deste parceiro.']);
  const { credenciais } = (await app.pedir<{ credenciais: { categoria: string; parceiro: string; qr: string | null }[] }>('GET', '/credenciais', tina)).corpo;
  assert.deepEqual(credenciais.map((c) => [c.categoria, c.parceiro, typeof c.qr]), [['expositor', 'Xis Med', 'string']]);
  assert.deepEqual((await portal(rui)).equipe.map((m) => [m.nome, m.papel, m.credencialId !== null]), [['Rui', 'responsavel', false], ['Tina', 'equipe', true]]);
});

test('assinatura pelo gov.br: a organização registra com o protocolo', async () => {
  const { corpo: { id } } = await app.pedir<{ id: string }>('POST', `${EV}/contratos`, ana, { parceiroEventoId: ids.peY, corpo: 'Contrato de cessão de espaço, assinado pelo gov.br.', via: 'govbr_manual' });
  await app.pedir('POST', `/organizador/contratos/${id}/enviar`, ana);
  assert.equal((await app.pedir('POST', `/contratos/${id}/assinar`, sol)).status, 403);
  assert.equal((await app.pedir('POST', `/organizador/contratos/${id}/registrar-assinatura`, ana, {})).status, 422);
  assert.equal((await app.pedir('POST', `/organizador/contratos/${id}/registrar-assinatura`, ana, { referencia: 'gov.br 2027-000123' })).status, 204);
  assert.equal((await app.pedir('POST', `/organizador/contratos/${id}/cancelar`, ana)).status, 409);
});

test('visão da organização e lista pública: nível é rótulo, a ordem é alfabética', async () => {
  const { corpo } = await app.pedir<{ parceiros: { parceiro: string; nivel: string | null; estandes: number; credenciaisEmitidas: number; montagem: string | null; contrato: string | null; servicosCentavos: number }[] }>('GET', `${EV}/feira`, ana);
  assert.deepEqual(corpo.parceiros, [
    { ...corpo.parceiros[0], parceiro: 'Xis Med', nivel: 'Ouro', estandes: 2, credenciaisEmitidas: 1, montagem: 'aprovada', contrato: 'assinado', servicosCentavos: 100000 },
    { ...corpo.parceiros[1], parceiro: 'Ypsilon Farma S.A.', nivel: null, estandes: 0, credenciaisEmitidas: 0, montagem: null, contrato: 'assinado', servicosCentavos: 0 },
  ]);
  await app.pedir('PUT', `/portal/${ids.peY}/perfil`, sol, { nomeExibicao: 'Alfa Ypsilon', publicado: true });
  await app.pedir('PATCH', EV, ana, { publicado: true });
  const publico = await app.pedir<{ expositores: { nomeExibicao: string; nivel: string | null; estandes: string[]; logoDescricao: string | null }[]; estandes: Record<string, unknown>[] }>('GET', '/eventos/jornada-2027/expositores');
  assert.deepEqual(publico.corpo.expositores.map((e) => [e.nomeExibicao, e.nivel, e.estandes, e.logoDescricao]), [
    ['Alfa Ypsilon', null, [], null],
    ['Xis Med', 'Ouro', ['A1', 'I1'], 'Letra X azul'],
  ]);
  // O mapa público diz se o estande está livre ou vendido, nunca de quem é.
  assert.ok(publico.corpo.estandes.every((e) => !('parceiroEventoId' in e)));
});

test('auditoria da feira e dos contratos', async () => {
  const acoes = new Set((await app.dono<{ acao: string }>('select acao from auditoria')).map((l) => l.acao));
  for (const a of ['estande.reservar', 'perfil_expositor.salvar', 'servico.pedir', 'montagem.salvar', 'montagem.analisar', 'contrato.criar', 'contrato.enviar', 'contrato.assinar', 'credencial.emitir']) assert.ok(acoes.has(a), a);
});

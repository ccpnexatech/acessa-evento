/**
 * Feature 10 no banco, com o papel real da API (app_api): parceiros, portal do
 * expositor, estandes, nível derivado, serviços, montagem e contratos (ADR 0028).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { criarBancoDeTeste } from '../apoio/banco.ts';
import type { BancoDeTeste } from '../apoio/banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';

let b: BancoDeTeste;
let api: Banco;
type Nome = 'ana' | 'bia' | 'vera' | 'fin' | 'rui' | 'tina' | 'sol' | 'eva' | 'orgA' | 'orgB' | 'eventoA' | 'eventoB'
  | 'parceiroX' | 'parceiroY' | 'peX' | 'peY' | 'planta' | 'tipo' | 'ilha' | 'a1' | 'a2' | 'a3' | 'segmento'
  | 'energia' | 'contratoX' | 'contratoY';
const ids = {} as Record<Nome, string>;
const hash = (n: number) => Buffer.alloc(32, n);
const CORPO = 'Contrato de cessão de espaço na feira do evento. Cláusula única.';

const um = <T>(linhas: readonly T[]): T => {
  const [linha] = linhas;
  if (linha === undefined) throw new Error('consulta sem linhas');
  return linha;
};
const como = <T extends pg.QueryResultRow>(pessoaId: string, sql: string, valores: unknown[] = []) =>
  api.transacao({ pessoaId }, (tx) => tx.consultar<T>(sql, valores));
const dono = async <T extends pg.QueryResultRow>(sql: string, valores: unknown[] = []) => (await b.dono.query<T>(sql, valores)).rows;
const criar = async (quem: string, sql: string, valores: unknown[] = []) => um(await como<{ id: string }>(quem, `${sql} returning id`, valores)).id;

before(async () => {
  b = await criarBancoDeTeste();
  api = new Banco({ url: b.url, papel: 'app_api' });
  const pessoa = async (n: number, nome: string) => um(await dono<{ id: string }>(
    'insert into pessoa (email_cifrado, email_hash, nome_cracha) values ($1, $2, $3) returning id', [Buffer.from('c'), hash(n), nome])).id;
  ids.ana = await pessoa(1, 'Ana');   // dona de A
  ids.bia = await pessoa(2, 'Bia');   // dona de B
  ids.vera = await pessoa(3, 'Vera'); // comercial em A
  ids.fin = await pessoa(4, 'Fin');   // financeiro em A
  ids.rui = await pessoa(5, 'Rui');   // responsável do expositor X
  ids.tina = await pessoa(6, 'Tina'); // equipe do expositor X
  ids.sol = await pessoa(7, 'Sol');   // responsável do expositor Y
  ids.eva = await pessoa(8, 'Eva');   // ninguém
  ids.orgA = um(await como<{ id: string }>(ids.ana, "select criar_organizacao('Sociedade A') as id")).id;
  ids.orgB = um(await como<{ id: string }>(ids.bia, "select criar_organizacao('Sociedade B') as id")).id;
  const evento = async (org: string, slug: string) => um(await dono<{ id: string }>(
    "insert into evento (organizacao_id, slug, nome, inicio, fim, local, publicado) values ($1, $2, $2, '2027-03-01', '2027-03-03', 'Fortaleza', true) returning id", [org, slug])).id;
  ids.eventoA = await evento(ids.orgA, 'evento-a');
  ids.eventoB = await evento(ids.orgB, 'evento-b');
  await dono("insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, 'comercial'), ($1, $3, 'financeiro')", [ids.eventoA, ids.vera, ids.fin]);
});

after(async () => {
  await api.fechar();
  await b.apagar();
});

test('comercial cadastra o parceiro na organização e o liga ao evento', async () => {
  ids.parceiroX = await criar(ids.vera, "insert into parceiro (organizacao_id, razao_social, nome_fantasia, cnpj) values ($1, 'Xis Equipamentos Ltda', 'Xis Med', '11222333000181')", [ids.orgA]);
  ids.parceiroY = await criar(ids.vera, "insert into parceiro (organizacao_id, razao_social) values ($1, 'Ypsilon Farma S.A.')", [ids.orgA]);
  ids.peX = await criar(ids.vera, 'insert into parceiro_evento (parceiro_id, evento_id) values ($1, $2)', [ids.parceiroX, ids.eventoA]);
  ids.peY = await criar(ids.vera, 'insert into parceiro_evento (parceiro_id, evento_id) values ($1, $2)', [ids.parceiroY, ids.eventoA]);
  // Outra organização não cadastra aqui, nem leva o parceiro para o evento dela.
  await assert.rejects(como(ids.bia, "insert into parceiro (organizacao_id, razao_social) values ($1, 'Invasor')", [ids.orgA]), /row-level security/);
  await assert.rejects(dono('insert into parceiro_evento (parceiro_id, evento_id) values ($1, $2)', [ids.parceiroX, ids.eventoB]), /não pertence à organização/);
  await assert.rejects(como(ids.vera, "insert into parceiro_evento (parceiro_id, evento_id, categoria) values ($1, $2, 'congressista')", [ids.parceiroX, ids.eventoA]), /categoria_check/);
  assert.deepEqual(await como(ids.bia, 'select 1 from parceiro'), []);
  assert.deepEqual(await como(ids.eva, 'select 1 from parceiro_evento'), []);
});

test('convite do portal: comercial convida o responsável, que convida a própria equipe', async () => {
  const convidar = (quem: string, pe: string, email: number, papeis: string[]) => criar(quem,
    `insert into convite (organizacao_id, evento_id, parceiro_evento_id, email_cifrado, email_hash, papeis, criado_por)
     values ($1, $2, $3, $4, $5, $6, $7)`, [ids.orgA, ids.eventoA, pe, Buffer.from('c'), hash(email), papeis, quem]);
  const doRui = await convidar(ids.vera, ids.peX, 5, ['responsavel']);
  const daSol = await convidar(ids.vera, ids.peY, 7, ['responsavel']);
  assert.deepEqual(await como(ids.rui, 'select parceiro, papeis from meus_convites()'), [{ parceiro: 'Xis Med', papeis: ['responsavel'] }]);
  assert.deepEqual(await como(ids.rui, 'select aceitar_convite($1) as ok', [doRui]), [{ ok: true }]);
  assert.deepEqual(await como(ids.sol, 'select aceitar_convite($1) as ok', [daSol]), [{ ok: true }]);
  const daTina = await convidar(ids.rui, ids.peX, 6, ['equipe']);
  assert.deepEqual(await como(ids.tina, 'select aceitar_convite($1) as ok', [daTina]), [{ ok: true }]);
  // O responsável não cria outro responsável, não convida para o parceiro vizinho, e a equipe não convida.
  await assert.rejects(convidar(ids.rui, ids.peX, 8, ['responsavel']), /row-level security/);
  await assert.rejects(convidar(ids.rui, ids.peY, 8, ['equipe']), /row-level security/);
  await assert.rejects(convidar(ids.tina, ids.peX, 8, ['equipe']), /row-level security/);
  await assert.rejects(convidar(ids.vera, ids.peX, 8, ['admin']), /convite_check/);
  // Cada parceiro vê a própria equipe e a própria empresa; nunca a do vizinho.
  assert.equal((await como(ids.rui, 'select 1 from membro_parceiro')).length, 2);
  assert.equal((await como(ids.sol, 'select 1 from membro_parceiro')).length, 1);
  assert.deepEqual(await como(ids.sol, 'select razao_social from parceiro'), [{ razao_social: 'Ypsilon Farma S.A.' }]);
  assert.deepEqual(await como(ids.sol, 'select 1 from convite'), []);
});

test('a organização desenha a feira: planta, tipos, estandes, níveis, segmentos e serviços', async () => {
  ids.planta = await criar(ids.vera, "insert into planta (evento_id, nome, colunas, linhas) values ($1, 'Pavilhão', 10, 6)", [ids.eventoA]);
  ids.tipo = await criar(ids.vera, "insert into tipo_estande (evento_id, nome, largura_m, profundidade_m, preco_centavos) values ($1, 'Linha 3x3', 3, 3, 600000)", [ids.eventoA]);
  ids.ilha = await criar(ids.vera, "insert into tipo_estande (evento_id, nome, largura_m, profundidade_m, preco_centavos) values ($1, 'Ilha 6x6', 6, 6, 3000000)", [ids.eventoA]);
  const estande = (codigo: string, coluna: number, tipo = ids.tipo) => criar(ids.vera,
    'insert into estande (evento_id, planta_id, tipo_estande_id, codigo, coluna, linha) values ($1, $2, $3, $4, $5, 1)', [ids.eventoA, ids.planta, tipo, codigo, coluna]);
  ids.a1 = await estande('A1', 1);
  ids.a2 = await estande('A2', 2);
  ids.a3 = await estande('A3', 3, ids.ilha);
  await assert.rejects(estande('A9', 1), /estande_planta_id_coluna_linha_key/);
  await como(ids.vera, "insert into nivel_expositor (evento_id, nome, investimento_minimo_centavos, beneficios) values ($1, 'Bronze', 0, '{}'), ($1, 'Prata', 1000000, array['Selo na lista']), ($1, 'Ouro', 3000000, array['Selo na lista', 'Aviso no app'])", [ids.eventoA]);
  ids.segmento = await criar(ids.vera, "insert into segmento (evento_id, nome) values ($1, 'Equipamentos')", [ids.eventoA]);
  ids.energia = await criar(ids.vera, "insert into servico_feira (evento_id, nome, unidade, preco_centavos, prazo) values ($1, 'Energia', 'kVA', 25000, '2099-01-01')", [ids.eventoA]);
  await como(ids.vera, "insert into servico_feira (evento_id, nome, preco_centavos, prazo) values ($1, 'Internet', 80000, '2020-01-01')", [ids.eventoA]);
  // O público vê o mapa; só a organização desenha; a vizinha não mexe.
  assert.equal((await api.transacao({}, (tx) => tx.consultar('select 1 from estande'))).length, 3);
  await assert.rejects(como(ids.rui, "insert into estande (evento_id, planta_id, tipo_estande_id, codigo, coluna, linha) values ($1, $2, $3, 'Z1', 9, 1)", [ids.eventoA, ids.planta, ids.tipo]), /row-level security/);
  await assert.rejects(como(ids.bia, "insert into planta (evento_id, nome, colunas, linhas) values ($1, 'Invasora', 2, 2)", [ids.eventoA]), /row-level security/);
  // Ninguém marca estande como vendido direto na tabela.
  await assert.rejects(como(ids.vera, "update estande set situacao = 'vendido' where id = $1", [ids.a1]), /permission denied/);
});

test('reserva de estande: só um leva, vale 48 horas e guarda o preço do dia', async () => {
  const reservar = (quem: string, estande: string, pe: string) => como<{ ok: boolean }>(quem, 'select reservar_estande($1, $2) as ok', [estande, pe]);
  assert.deepEqual(await reservar(ids.rui, ids.a1, ids.peX), [{ ok: true }]);
  assert.deepEqual(await reservar(ids.sol, ids.a1, ids.peY), [{ ok: false }]);
  await assert.rejects(reservar(ids.tina, ids.a2, ids.peX), /sem permissão/);   // equipe não reserva
  await assert.rejects(reservar(ids.rui, ids.a2, ids.peY), /sem permissão/);    // nem em nome do vizinho
  await assert.rejects(reservar(ids.eva, ids.a2, ids.peX), /sem permissão/);
  const a1 = um(await dono<{ situacao: string; valor_centavos: number; horas: number }>(
    "select situacao, valor_centavos, round(extract(epoch from reservado_ate - now()) / 3600)::int as horas from estande where id = $1", [ids.a1]));
  assert.deepEqual(a1, { situacao: 'reservado', valor_centavos: 600000, horas: 48 });
  // A Sol reserva o dela e desiste; não solta o do vizinho.
  assert.deepEqual(await reservar(ids.sol, ids.a2, ids.peY), [{ ok: true }]);
  assert.deepEqual(await como(ids.sol, 'select liberar_estande($1) as ok', [ids.a1]), [{ ok: false }]);
  assert.deepEqual(await como(ids.sol, 'select liberar_estande($1) as ok', [ids.a2]), [{ ok: true }]);
  // Reserva vencida volta a ficar livre pelo agendador.
  assert.deepEqual(await reservar(ids.sol, ids.a2, ids.peY), [{ ok: true }]);
  await dono("update estande set reservado_ate = now() - interval '1 minute' where id = $1", [ids.a2]);
  assert.deepEqual(await api.transacao({}, (tx) => tx.consultar('select liberar_reservas_vencidas() as n')), [{ n: 1 }]);
  assert.deepEqual(await reservar(ids.rui, ids.a3, ids.peX), [{ ok: true }]);
  // Estande ocupado não se apaga nem se redesenha.
  assert.deepEqual(await como(ids.vera, 'delete from estande where id = $1 returning id', [ids.a1]), []);
  assert.deepEqual(await como(ids.vera, "update estande set codigo = 'B1' where id = $1 returning id", [ids.a1]), []);
});

test('marca no app: o responsável edita a sua; logo sem descrição é recusado', async () => {
  await assert.rejects(como(ids.rui, "insert into perfil_expositor (parceiro_evento_id, evento_id, nome_exibicao, logo_url) values ($1, $2, 'Xis Med', 'https://exemplo.com.br/logo.png')", [ids.peX, ids.eventoA]), /perfil_expositor_check/);
  await como(ids.rui, "insert into perfil_expositor (parceiro_evento_id, evento_id, nome_exibicao, logo_url, logo_descricao, segmento_id, frase, publicado) values ($1, $2, 'Xis Med', 'https://exemplo.com.br/logo.png', 'Logo da Xis Med: letra X azul', $3, 'Monitores para anestesia', true)", [ids.peX, ids.eventoA, ids.segmento]);
  await assert.rejects(como(ids.rui, "insert into perfil_expositor (parceiro_evento_id, evento_id, nome_exibicao) values ($1, $2, 'Tomado')", [ids.peY, ids.eventoA]), /row-level security/);
  assert.deepEqual(await como(ids.sol, "update perfil_expositor set frase = 'Trocada' where parceiro_evento_id = $1 returning 1", [ids.peX]), []);
  assert.deepEqual(await como(ids.tina, "update perfil_expositor set frase = 'Pela equipe' where parceiro_evento_id = $1 returning 1", [ids.peX]), []);
});

test('serviços: valor é preço vezes quantidade, prazo vale para o parceiro e só a organização confirma', async () => {
  const pedido = await criar(ids.rui, 'insert into pedido_servico (evento_id, parceiro_evento_id, servico_feira_id, quantidade) values ($1, $2, $3, 4)', [ids.eventoA, ids.peX, ids.energia]);
  assert.deepEqual(await como(ids.rui, 'select valor_centavos from pedido_servico'), [{ valor_centavos: 100000 }]);
  const internet = um(await dono<{ id: string }>("select id from servico_feira where nome = 'Internet'")).id;
  await assert.rejects(como(ids.rui, 'insert into pedido_servico (evento_id, parceiro_evento_id, servico_feira_id, quantidade) values ($1, $2, $3, 1)', [ids.eventoA, ids.peX, internet]), /fora do prazo/);
  await assert.rejects(como(ids.rui, "update pedido_servico set situacao = 'confirmado' where id = $1", [pedido]), /só a organização confirma/);
  await assert.rejects(como(ids.rui, 'insert into pedido_servico (evento_id, parceiro_evento_id, servico_feira_id, quantidade, valor_centavos) values ($1, $2, $3, 1, 1)', [ids.eventoA, ids.peX, internet]), /permission denied/);
  await como(ids.rui, 'update pedido_servico set quantidade = 6 where id = $1', [pedido]);
  await como(ids.vera, "update pedido_servico set situacao = 'confirmado' where id = $1", [pedido]);
  assert.deepEqual(await como(ids.fin, 'select valor_centavos, situacao from pedido_servico'), [{ valor_centavos: 150000, situacao: 'confirmado' }]);
  await assert.rejects(como(ids.rui, 'update pedido_servico set quantidade = 1 where id = $1', [pedido]), /já confirmado/);
  // O vizinho não vê nem pede em nome de outro.
  assert.deepEqual(await como(ids.sol, 'select 1 from pedido_servico'), []);
  await assert.rejects(como(ids.sol, 'insert into pedido_servico (evento_id, parceiro_evento_id, servico_feira_id, quantidade) values ($1, $2, $3, 1)', [ids.eventoA, ids.peX, ids.energia]), /row-level security/);
});

test('montagem: básica nasce aprovada; montadora própria só vai para análise com projeto, ART e termo', async () => {
  await como(ids.sol, 'insert into montagem (parceiro_evento_id, evento_id) values ($1, $2)', [ids.peY, ids.eventoA]);
  assert.deepEqual(await como(ids.sol, 'select situacao from montagem'), [{ situacao: 'aprovada' }]);
  await como(ids.rui, "insert into montagem (parceiro_evento_id, evento_id, tipo, montadora) values ($1, $2, 'montadora_propria', 'Monta Bem')", [ids.peX, ids.eventoA]);
  const situacao = async () => um(await como<{ situacao: string }>(ids.rui, 'select situacao from montagem')).situacao;
  assert.equal(await situacao(), 'pendente');
  assert.deepEqual(await como(ids.vera, 'select analisar_montagem($1, true) as ok', [ids.peX]), [{ ok: false }]);
  await como(ids.rui, "update montagem set projeto_url = 'https://exemplo.com.br/projeto.pdf', art_rrt = 'ART 123456', termo_aceito_em = now() where parceiro_evento_id = $1", [ids.peX]);
  assert.equal(await situacao(), 'em_analise');
  // O parceiro não aprova a si mesmo.
  await assert.rejects(como(ids.rui, "update montagem set situacao = 'aprovada' where parceiro_evento_id = $1", [ids.peX]), /permission denied/);
  assert.deepEqual(await como(ids.rui, 'select analisar_montagem($1, true) as ok', [ids.peX]), [{ ok: false }]);
  assert.deepEqual(await como(ids.vera, "select analisar_montagem($1, false, 'Altura acima de 4 m') as ok", [ids.peX]), [{ ok: true }]);
  assert.equal(await situacao(), 'recusada');
  // Corrigiu o projeto, volta para análise.
  await como(ids.rui, "update montagem set projeto_url = 'https://exemplo.com.br/projeto-v2.pdf' where parceiro_evento_id = $1", [ids.peX]);
  assert.equal(await situacao(), 'em_analise');
  assert.deepEqual(await como(ids.vera, 'select analisar_montagem($1, true) as ok', [ids.peX]), [{ ok: true }]);
  assert.deepEqual(await como(ids.sol, 'select count(*)::int as n from montagem'), [{ n: 1 }]);
});

test('contrato: rascunho é da organização; enviado não muda; quem assina é o responsável', async () => {
  const redigir = (quem: string, pe: string, via = 'aceite_no_app') => criar(quem,
    'insert into contrato (evento_id, parceiro_evento_id, corpo, valor_centavos, via, criado_por) values ($1, $2, $3, 3600000, $4, $5)', [ids.eventoA, pe, CORPO, via, quem]);
  ids.contratoX = await redigir(ids.vera, ids.peX);
  ids.contratoY = await redigir(ids.fin, ids.peY, 'govbr_manual');
  await assert.rejects(redigir(ids.rui, ids.peX), /row-level security/);
  await assert.rejects(como(ids.vera, 'insert into contrato (evento_id, corpo, criado_por) values ($1, $2, $3)', [ids.eventoA, CORPO, ids.vera]), /contrato_check/);
  // Rascunho o parceiro não vê; credencial antes da assinatura não sai.
  assert.deepEqual(await como(ids.rui, 'select 1 from contrato'), []);
  await assert.rejects(como(ids.rui, 'select emitir_credencial_parceiro($1, $2)', [ids.peX, ids.tina]), /contrato ainda não assinado/);
  assert.deepEqual(await como(ids.rui, 'select assinar_contrato($1) as ok', [ids.contratoX]), [{ ok: false }]);
  assert.deepEqual(await como(ids.rui, 'select enviar_contrato($1) as ok', [ids.contratoX]), [{ ok: false }]);
  assert.deepEqual(await como(ids.vera, 'select enviar_contrato($1) as ok', [ids.contratoX]), [{ ok: true }]);
  assert.deepEqual(await como(ids.fin, 'select enviar_contrato($1) as ok', [ids.contratoY]), [{ ok: true }]);
  await assert.rejects(como(ids.vera, "update contrato set corpo = corpo || ' Cláusula escondida.' where id = $1", [ids.contratoX]), /não pode ser alterado/);
  // Cada responsável vê só o seu; equipe, vizinho e outra organização, nenhum.
  assert.deepEqual((await como<{ id: string }>(ids.rui, 'select id from contrato')).map((c) => c.id), [ids.contratoX]);
  assert.deepEqual(await como(ids.tina, 'select 1 from contrato'), []);
  assert.deepEqual(await como(ids.bia, 'select 1 from contrato'), []);
  await assert.rejects(como(ids.sol, 'select assinar_contrato($1)', [ids.contratoX]), /sem permissão/);
  await assert.rejects(como(ids.tina, 'select assinar_contrato($1)', [ids.contratoX]), /sem permissão/);
  await assert.rejects(como(ids.vera, 'select assinar_contrato($1)', [ids.contratoX]), /sem permissão/); // aceite é de quem contrata
  assert.deepEqual(await como(ids.rui, 'select assinar_contrato($1) as ok', [ids.contratoX]), [{ ok: true }]);
  const assinado = um(await como<{ situacao: string; assinado_por: string; confere: boolean }>(ids.fin,
    "select situacao, assinado_por, corpo_hash = sha256(convert_to(corpo, 'UTF8')) as confere from contrato where id = $1", [ids.contratoX]));
  assert.deepEqual(assinado, { situacao: 'assinado', assinado_por: ids.rui, confere: true });
  // gov.br conferido à mão: a organização registra com o protocolo; o contratado não se autoassina.
  await assert.rejects(como(ids.sol, 'select assinar_contrato($1)', [ids.contratoY]), /sem permissão/);
  await assert.rejects(como(ids.fin, 'select assinar_contrato($1)', [ids.contratoY]), /sem permissão/);
  assert.deepEqual(await como(ids.fin, "select assinar_contrato($1, 'gov.br 2027-000123') as ok", [ids.contratoY]), [{ ok: true }]);
  assert.deepEqual(await como(ids.vera, 'select cancelar_contrato($1) as ok', [ids.contratoX]), [{ ok: false }]);
});

test('assinar liga tudo: estandes vendidos, parceiro ativo, nível calculado e credenciais por metragem', async () => {
  const estandes = await dono<{ codigo: string; situacao: string }>('select codigo, situacao from estande order by codigo');
  assert.deepEqual(estandes, [{ codigo: 'A1', situacao: 'vendido' }, { codigo: 'A2', situacao: 'livre' }, { codigo: 'A3', situacao: 'vendido' }]);
  assert.deepEqual(await como(ids.rui, 'select situacao from parceiro_evento'), [{ situacao: 'ativo' }]);
  // 9 m² + 36 m² = 45 m²; R$ 36.000 em estandes = Ouro; 1 credencial a cada 3 m² = 15.
  const resumo = um(await como<{ estandes: number; area_m2: string; investimento_centavos: number; nivel: string; credenciais_direito: number }>(ids.rui, 'select * from resumo_do_expositor($1)', [ids.peX]));
  assert.deepEqual(resumo, { estandes: 2, area_m2: '45.0000', investimento_centavos: 3600000, nivel: 'Ouro', credenciais_direito: 15 });
  // Sem estande vendido não há nível, por mais serviço que tenha pedido.
  assert.equal(um(await como<{ nivel: string | null }>(ids.sol, 'select nivel from resumo_do_expositor($1)', [ids.peY])).nivel, null);
  // Estande vendido o responsável não solta sozinho.
  assert.deepEqual(await como(ids.rui, 'select liberar_estande($1) as ok', [ids.a1]), [{ ok: false }]);

  const cred = um(await como<{ id: string }>(ids.rui, 'select emitir_credencial_parceiro($1, $2) as id', [ids.peX, ids.tina])).id;
  assert.deepEqual(await como(ids.tina, 'select categoria::text, parceiro_evento_id from credencial'), [{ categoria: 'expositor', parceiro_evento_id: ids.peX }]);
  await assert.rejects(como(ids.rui, 'select emitir_credencial_parceiro($1, $2)', [ids.peX, ids.eva]), /não é da equipe/);
  await assert.rejects(como(ids.sol, 'select emitir_credencial_parceiro($1, $2)', [ids.peX, ids.rui]), /sem permissão/);
  // Y assinou mas não comprou estande: direito a zero credenciais.
  await assert.rejects(como(ids.sol, 'select emitir_credencial_parceiro($1, $2)', [ids.peY, ids.sol]), /limite de credenciais/);
  // Limite por metragem: com 1 a cada 45 m², a segunda credencial não sai.
  await como(ids.ana, 'update evento set feira_m2_por_credencial = 45 where id = $1', [ids.eventoA]);
  await assert.rejects(como(ids.rui, 'select emitir_credencial_parceiro($1, $2)', [ids.peX, ids.rui]), /limite de credenciais/);
  assert.equal(um(await como<{ ok: boolean }>(ids.vera, 'select pode_entrar($1, null) as ok', [cred])).ok, true);
});

test('lista pública de expositores: só perfil publicado, em ordem alfabética, com nível como rótulo', async () => {
  await como(ids.sol, "insert into perfil_expositor (parceiro_evento_id, evento_id, nome_exibicao, publicado) values ($1, $2, 'Alfa Ypsilon', true)", [ids.peY, ids.eventoA]);
  const lista = await api.transacao({}, (tx) => tx.consultar<{ nome_exibicao: string; nivel: string | null; estandes: string[]; segmento: string | null }>(
    'select nome_exibicao, nivel, estandes, segmento from expositores_publicos($1)', [ids.eventoA]));
  assert.deepEqual(lista, [
    { nome_exibicao: 'Alfa Ypsilon', nivel: null, estandes: [], segmento: null },
    { nome_exibicao: 'Xis Med', nivel: 'Ouro', estandes: ['A1', 'A3'], segmento: 'Equipamentos' },
  ]);
  await como(ids.sol, 'update perfil_expositor set publicado = false where parceiro_evento_id = $1', [ids.peY]);
  assert.equal((await api.transacao({}, (tx) => tx.consultar('select 1 from expositores_publicos($1)', [ids.eventoA]))).length, 1);
  // Evento de demonstração não tem lista pública.
  await dono('update evento set demonstracao = true where id = $1', [ids.eventoA]);
  assert.deepEqual(await api.transacao({}, (tx) => tx.consultar('select 1 from expositores_publicos($1)', [ids.eventoA])), []);
});

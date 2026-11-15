/** Feature 08 pela API com Postgres real: regras de zona, credenciais, pacote do leitor, leituras offline e "Chegou o dia". */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { subirApp } from '../apoio/app.ts';
import type { AppDeTeste } from '../apoio/app.ts';
import { verificadorEd25519 } from '../../src/shared/qr/ed25519.ts';
import { lerToken } from '../../src/shared/qr/token.ts';
import { decidir } from '../../src/modules/acessos/domain/acessos.ts';
import type { Excecao, Regra } from '../../src/modules/acessos/domain/acessos.ts';

let app: AppDeTeste;
let ana: string;   // dona
let gil: string;   // credenciamento
let caio: string;  // congressista
let duda: string;  // segurança (recebe credencial pelo e-mail)
let vizinha: string;
let eventoId: string;
const ids = {} as Record<'vip' | 'geral' | 'portao' | 'portaVip' | 'credCaio' | 'credDuda' | 'ingresso', string>;
const EV = '/organizador/eventos/jornada-2027';
interface Pacote {
  chaves: { kid: string; publica: string }[];
  credenciais: { id: string; ingressoId: string | null; nome: string; categoria: string; revogada: boolean; entrada: { portao: string } | null }[];
  zonas: { id: string; nome: string; aberta: boolean }[]; regras: Regra[]; excecoes: Excecao[];
  pontos: { id: string; nome: string; zonaId: string | null; modo: string }[]; meias: { id: string; credencialId: string; documento: string; resultado: string | null }[];
}
interface Minhas { credenciais: { id: string; categoria: string; qr: string | null; ingressoId: string | null }[] }
const leitura = (extra: Record<string, unknown>) => ({ id: randomUUID(), metodo: 'qr', feitoEm: new Date().toISOString(), ...extra });
const enviar = (token: string, leituras: unknown[]) => app.pedir<{ resultado: { id: string; situacao: string }[] }>('POST', '/acessos/jornada-2027/leituras', token, { leituras });

before(async () => {
  app = await subirApp();
  ana = await app.entrar('ana@exemplo.com.br', 'Ana');
  gil = await app.entrar('gil@exemplo.com.br', 'Gil');
  caio = await app.entrar('caio@exemplo.com.br', 'Caio');
  vizinha = await app.entrar('vizinha@exemplo.com.br', 'Vizinha');
  const { corpo: org } = await app.pedir<{ id: string }>('POST', '/organizador/organizacoes', ana, { nome: 'Sociedade A' });
  const { corpo: evento } = await app.pedir<{ id: string }>('POST', `/organizador/organizacoes/${org.id}/eventos`, ana,
    { nome: 'Jornada 2027', slug: 'jornada-2027', inicio: '2027-03-01', fim: '2027-03-03', local: 'Fortaleza' });
  eventoId = evento.id;
  await app.pedir('PATCH', EV, ana, { publicado: true, inscricoesAbertas: true });
  const convite = await app.pedir<{ id: string }>('POST', `${EV}/convites`, ana, { email: 'gil@exemplo.com.br', papeis: ['credenciamento'] });
  await app.pedir('POST', `/convites/${convite.corpo.id}/aceitar`, gil);
  const criar = async (cadastro: string, corpo: unknown) => (await app.pedir<{ id: string }>('POST', `${EV}/${cadastro}`, ana, corpo)).corpo.id;
  ids.geral = await criar('zonas', { nome: 'Área geral', aberta: true });
  ids.vip = await criar('zonas', { nome: 'Sala VIP' });
  ids.portao = await criar('pontos-leitura', { nome: 'Portão 1' });
  ids.portaVip = await criar('pontos-leitura', { nome: 'Porta VIP', zonaId: ids.vip, modo: 'passagem_livre' });
  // Caio compra meia-entrada pela rota de inscrição da v1, agora declarando o motivo.
  const tipo = await criar('tipos-ingresso', { nome: 'Meia', precoCentavos: 5000, vagas: 10, modalidade: 'meia', publicoVeSaldo: true });
  const pagina = await app.pedir<{ tipos: { modalidade: string; vagasRestantes: number | null }[] }>('GET', '/eventos/jornada-2027');
  assert.deepEqual(pagina.corpo.tipos.map((t) => [t.modalidade, t.vagasRestantes]), [['meia', 10]]);
  const inscrever = (corpo: unknown) => fetch(`${app.base}/eventos/jornada-2027/inscricoes`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${caio}`, 'idempotency-key': `leitor-${randomUUID()}` }, body: JSON.stringify(corpo),
  });
  const semMotivo = await inscrever({ tipoIngressoId: tipo, metodo: 'pix' });
  assert.equal(semMotivo.status, 422);
  assert.match(((await semMotivo.json()) as { titulo: string }).titulo, /Informe o motivo da meia-entrada/);
  const feita = await inscrever({ tipoIngressoId: tipo, metodo: 'pix', motivoMeia: 'estudante' });
  assert.equal(feita.status, 201);
  ids.ingresso = ((await feita.json()) as { ingresso: { id: string } }).ingresso.id;
});
after(() => app.fechar());

test('regras da zona: a lista enviada substitui a anterior; quem não é de operação não muda', async () => {
  assert.equal((await app.pedir('PUT', `${EV}/zonas/${ids.vip}/regras`, ana, { regras: [{ categoria: 'palestrante' }, { categoria: 'convidado' }] })).status, 204);
  assert.equal((await app.pedir('PUT', `${EV}/zonas/${ids.vip}/regras`, ana, { regras: [{ categoria: 'palestrante' }] })).status, 204);
  const { corpo } = await app.pedir<{ regras: Regra[] }>('GET', `${EV}/regras-zona`, gil);
  assert.deepEqual(corpo.regras, [{ zonaId: ids.vip, categoria: 'palestrante', de: null, ate: null }]);
  assert.equal((await app.pedir('PUT', `${EV}/zonas/${ids.vip}/regras`, gil, { regras: [] })).status, 403);
  assert.equal((await app.pedir('PUT', `${EV}/zonas/${randomUUID()}/regras`, ana, { regras: [] })).status, 404);
  assert.equal((await app.pedir('GET', `${EV}/regras-zona`, vizinha)).status, 404);
});

test('credencial pelo e-mail: a conta nasce na emissão e a pessoa encontra o QR ao entrar', async () => {
  const emitida = await app.pedir<{ id: string }>('POST', `${EV}/credenciais`, ana, { email: 'Duda@exemplo.com.br', categoria: 'seguranca' });
  assert.equal(emitida.status, 201);
  ids.credDuda = emitida.corpo.id;
  const repetida = await app.pedir<{ titulo: string }>('POST', `${EV}/credenciais`, ana, { email: 'duda@exemplo.com.br', categoria: 'seguranca' });
  assert.deepEqual([repetida.status, repetida.corpo.titulo], [409, 'Esta pessoa já tem uma credencial ativa dessa categoria neste evento.']);
  assert.equal((await app.pedir('POST', `${EV}/credenciais`, ana, { email: 'x@exemplo.com.br', categoria: 'congressista' })).status, 422);
  assert.equal((await app.pedir('POST', `${EV}/credenciais`, gil, { email: 'x@exemplo.com.br', categoria: 'convidado' })).status, 403);
  // Quem não organiza nada não usa a API para criar contas alheias.
  assert.equal((await app.pedir('POST', `${EV}/credenciais`, caio, { email: 'x@exemplo.com.br', categoria: 'convidado' })).status, 404);
  duda = await app.entrar('duda@exemplo.com.br', 'Duda');
  const { corpo } = await app.pedir<Minhas>('GET', '/credenciais', duda);
  assert.deepEqual(corpo.credenciais.map((c) => [c.id, c.categoria, c.ingressoId]), [[ids.credDuda, 'seguranca', null]]);
});

test('o leitor decide sem internet: QR conferido pela chave do pacote e regra aplicada pela lista', async () => {
  const { corpo: pacote, status } = await app.pedir<Pacote>('GET', '/acessos/jornada-2027/pacote', gil);
  assert.equal(status, 200);
  const verificador = verificadorEd25519(new Map(pacote.chaves.map((c) => [c.kid, c.publica])));
  const agora = Date.parse('2027-03-01T12:00:00Z');
  const lerQr = async (token: string) => {
    const { corpo: { credenciais: [minha] } } = await app.pedir<Minhas>('GET', '/credenciais', token);
    const lido = lerToken(minha?.qr ?? '', verificador, eventoId, agora / 1000);
    assert.ok(lido.ok);
    // O QR do congressista leva o ingresso (igual ao da v1); o da segurança, a credencial.
    return pacote.credenciais.find((c) => (lido.conteudo.c ? c.id === lido.conteudo.c : c.ingressoId === lido.conteudo.i));
  };
  const [credCaio, credDuda] = [await lerQr(caio), await lerQr(duda)];
  assert.deepEqual([credCaio?.nome, credCaio?.categoria, credDuda?.nome, credDuda?.categoria], ['Caio', 'congressista', 'Duda', 'seguranca']);
  ids.credCaio = credCaio?.id ?? '';
  const zona = (id: string) => pacote.zonas.find((z) => z.id === id);
  const d = (c: typeof credCaio, z: ReturnType<typeof zona> | null) => decidir(c as never, z, pacote.regras, pacote.excecoes, agora);
  assert.deepEqual(d(credCaio, null), { entra: true });
  assert.deepEqual(d(credCaio, zona(ids.geral)), { entra: true });
  assert.deepEqual(d(credCaio, zona(ids.vip)), { entra: false, motivo: 'sem_regra' });
  assert.deepEqual(d(credDuda, zona(ids.vip)), { entra: false, motivo: 'sem_regra' });
  // A mesma pergunta ao banco dá a mesma resposta.
  const [noBanco] = await app.banco.transacao({ pessoaId: await app.pessoaDe('gil@exemplo.com.br') }, (tx) =>
    tx.consultar<{ a: boolean; b: boolean }>('select pode_entrar($1, $2) as a, pode_entrar($1, $3) as b', [ids.credCaio, ids.vip, ids.geral]));
  assert.deepEqual(noBanco, { a: false, b: true });
  assert.deepEqual(pacote.meias.map((m) => [m.credencialId, m.documento, m.resultado]), [[ids.credCaio, 'carteira de estudante', null]]);
  assert.deepEqual(pacote.pontos.map((p) => p.nome), ['Porta VIP', 'Portão 1']);
  // Participante e outra organização não baixam o pacote.
  assert.equal((await app.pedir('GET', '/acessos/jornada-2027/pacote', caio)).status, 404);
  assert.equal((await app.pedir('GET', '/acessos/jornada-2027/pacote', vizinha)).status, 404);
});

test('exceção e revogação chegam ao leitor na próxima sincronização, sem reemitir QR', async () => {
  assert.equal((await app.pedir('PUT', `${EV}/credenciais/${ids.credCaio}/excecoes/${ids.vip}`, ana, { efeito: 'permite', motivo: 'Homenageado da noite' })).status, 204);
  const qrAntes = (await app.pedir<Minhas>('GET', '/credenciais', duda)).corpo.credenciais[0]?.qr;
  assert.equal((await app.pedir('POST', `${EV}/credenciais/${ids.credDuda}/revogar`, ana, { motivo: 'Fora da escala' })).status, 204);
  assert.equal((await app.pedir('POST', `${EV}/credenciais/${ids.credDuda}/revogar`, ana, { motivo: 'De novo' })).status, 404);
  // Credencial de congressista não se cancela aqui: é pelo ingresso.
  assert.equal((await app.pedir('POST', `${EV}/credenciais/${ids.credCaio}/revogar`, ana, { motivo: 'Tentativa' })).status, 404);
  const { corpo: pacote } = await app.pedir<Pacote>('GET', '/acessos/jornada-2027/pacote', gil);
  const [credCaio, credDuda] = [pacote.credenciais.find((c) => c.id === ids.credCaio), pacote.credenciais.find((c) => c.id === ids.credDuda)];
  const vip = pacote.zonas.find((z) => z.id === ids.vip);
  assert.deepEqual(decidir(credCaio as never, vip, pacote.regras, pacote.excecoes, Date.now()), { entra: true });
  // O QR antigo da Duda ainda confere na assinatura; quem barra é a lista.
  assert.ok(qrAntes);
  assert.deepEqual(decidir(credDuda as never, null, pacote.regras, pacote.excecoes, Date.now()), { entra: false, motivo: 'credencial_revogada' });
  assert.equal((await app.pedir<Minhas>('GET', '/credenciais', duda)).corpo.credenciais[0]?.qr, null);
  assert.equal((await app.pedir('DELETE', `${EV}/credenciais/${ids.credCaio}/excecoes/${ids.vip}`, gil)).status, 404);
});

test('leituras: entrada única vale a primeira, passagem livre conta todas, barrada também sobe, reenviar não duplica', async () => {
  const cedo = leitura({ credencialId: ids.credCaio, pontoId: ids.portao, feitoEm: '2026-11-15T08:00:00Z' });
  const tarde = leitura({ ingressoId: ids.ingresso, portao: 'Portão 2', feitoEm: '2026-11-15T08:10:00Z' });
  const vip1 = leitura({ credencialId: ids.credCaio, pontoId: ids.portaVip, feitoEm: '2026-11-15T09:00:00Z' });
  const vip2 = leitura({ credencialId: ids.credCaio, pontoId: ids.portaVip, feitoEm: '2026-11-15T09:30:00Z' });
  const barrada = leitura({ credencialId: ids.credDuda, pontoId: ids.portao, resultado: 'negado', feitoEm: '2026-11-15T09:40:00Z' });
  const alheia = leitura({ credencialId: randomUUID(), pontoId: ids.portao });
  // O portão 2 (offline) envia primeiro a leitura mais tardia: ela vale até chegar a mais antiga.
  assert.deepEqual((await enviar(gil, [tarde])).corpo.resultado, [{ id: tarde.id, situacao: 'registrada' }]);
  const lote = await enviar(gil, [cedo, vip1, vip2, barrada, alheia]);
  assert.deepEqual(lote.corpo.resultado.map((r) => r.situacao), ['registrada', 'registrada', 'registrada', 'registrada', 'ignorada']);
  assert.deepEqual((await enviar(gil, [tarde, cedo])).corpo.resultado.map((r) => r.situacao), ['repetida', 'registrada']);
  assert.equal((await app.dono('select 1 from checkin')).length, 5);
  // A v1 continua enxergando a entrada no evento, e só ela.
  assert.deepEqual(await app.dono("select portao, to_char(feito_em at time zone 'UTC', 'HH24:MI') as hora from checkin_primeiro"), [{ portao: 'Portão 1', hora: '08:00' }]);
  assert.equal((await enviar(caio, [leitura({ credencialId: ids.credCaio, pontoId: ids.portao })])).status, 404);
  assert.equal((await enviar(gil, [])).status, 422);
});

test('meia-entrada: a equipe confere na entrada e a declaração fica assinada', async () => {
  const { corpo: { meias: [meia] } } = await app.pedir<Pacote>('GET', '/acessos/jornada-2027/pacote', gil);
  assert.equal((await app.pedir('POST', `/acessos/jornada-2027/meias/${meia?.id}/conferir`, gil, { resultado: 'confirmada' })).status, 204);
  const [linha] = await app.dono<{ resultado: string; conferida_por: string }>('select resultado, conferida_por from elegibilidade_meia');
  assert.deepEqual(linha, { resultado: 'confirmada', conferida_por: await app.pessoaDe('gil@exemplo.com.br') });
  assert.equal((await app.pedir('POST', `/acessos/jornada-2027/meias/${meia?.id}/conferir`, caio, { resultado: 'confirmada' })).status, 404);
  assert.equal((await app.pedir('POST', `/acessos/jornada-2027/meias/${meia?.id}/conferir`, gil, { resultado: 'talvez' })).status, 422);
});

test('chegou o dia: entradas registradas por ponto, ponto que sincronizou e ponto que ainda não', async () => {
  await app.pedir('POST', `${EV}/pontos-leitura`, ana, { nome: 'Portão 3' });
  const { corpo } = await app.pedir<{ numeros: Record<string, number>; pontos: { nome: string; entradas: number; saidas: number; negadas: number; atencao: string | null }[] }>('GET', `${EV}/hoje`, ana);
  assert.deepEqual(corpo.numeros, { inscritos: 1, credenciais: 1, entradas: 1, leiturasNegadas: 1 });
  assert.deepEqual(corpo.pontos.map((p) => [p.nome, p.entradas, p.negadas, p.atencao]), [
    ['Porta VIP', 2, 0, null],
    ['Portão 1', 1, 1, null],
    ['Portão 3', 0, 0, 'Ainda não sincronizou. Abra o leitor neste ponto com internet.'],
  ]);
  assert.equal((await app.pedir('GET', `${EV}/hoje`, vizinha)).status, 404);
});

test('avisos chegam a quem tem credencial da categoria, na hora marcada; a exportação da conta inclui credencial e meia', async () => {
  await app.pedir('POST', `${EV}/avisos`, ana, { titulo: 'Para todos', corpo: 'O credenciamento abre às 7h.' });
  await app.pedir('POST', `${EV}/avisos`, ana, { titulo: 'Só segurança', corpo: 'Troca de turno às 13h.', categorias: ['seguranca'], urgente: true });
  await app.pedir('POST', `${EV}/avisos`, ana, { titulo: 'Amanhã', corpo: 'Ainda não publicado.', publicarEm: new Date(Date.now() + 86_400_000).toISOString() });
  const titulos = async (token: string) => (await app.pedir<{ avisos: { titulo: string }[] }>('GET', '/eventos/jornada-2027/avisos', token)).corpo.avisos.map((a) => a.titulo);
  assert.deepEqual(await titulos(caio), ['Para todos']);
  assert.deepEqual(await titulos(duda), []);                      // credencial revogada não recebe
  assert.deepEqual(await titulos(ana), ['Só segurança', 'Para todos']); // a equipe vê os publicados, urgente primeiro
  assert.deepEqual(await titulos(vizinha), []);
  assert.equal((await app.pedir('GET', '/eventos/jornada-2027/avisos')).status, 401);
  const dados = (await app.pedir<{ credenciais: { categoria: string }[]; meiaEntrada: { motivo: string; resultado: string }[] }>('GET', '/conta/exportacao', caio)).corpo;
  assert.deepEqual(dados.credenciais.map((c) => c.categoria), ['congressista']);
  assert.deepEqual(dados.meiaEntrada.map((m) => [m.motivo, m.resultado]), [['estudante', 'confirmada']]);
});

test('manutenção: libera reserva vencida e apaga declaração de meia fora do prazo', async () => {
  const { rodarManutencao } = await import('../../src/shared/db/manutencao.ts');
  assert.deepEqual(await rodarManutencao(app.banco), { acessibilidade: 0, meia: 0, reservas: 0 });
  await app.dono('update elegibilidade_meia set apagar_apos = current_date - 1');
  assert.deepEqual(await rodarManutencao(app.banco), { acessibilidade: 0, meia: 1, reservas: 0 });
});

test('auditoria do controle de acesso não guarda e-mail nem motivo de meia-entrada', async () => {
  const linhas = await app.dono<{ acao: string; dados: unknown }>("select acao, dados from auditoria where acao ~ '^(zona|credencial|acessos|leitura|meia)\\.'");
  const acoes = new Set(linhas.map((l) => l.acao));
  for (const a of ['zona.regras', 'credencial.emitir', 'credencial.revogar', 'credencial.excecao', 'acessos.pacote', 'meia.conferir']) assert.ok(acoes.has(a), a);
  assert.ok(!/@exemplo|estudante/.test(JSON.stringify(linhas)));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeiraServico } from './feira.ts';
import type { Participacao, RepositorioFeira } from './feira.ts';

const ID = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const EVENTO = { id: ID(1), slug: 'cocal-2026', nome: 'COCAL 2026', organizacaoId: ID(2), organizacao: 'Sociedade A' };
const PART: Participacao = { id: ID(3), parceiro: 'Xis Med', categoria: 'expositor', situacao: 'convidado', papel: 'responsavel', evento: EVENTO };
const codigo = (c: string) => (e: { codigo?: string }) => e.codigo === c;

/** Repositório de mentira: responde o padrão abaixo, salvo o que o teste trocar. `false` simula o banco recusando. */
function montar(trocas: Partial<Record<keyof RepositorioFeira, unknown>> = {}) {
  const auditoria: { acao: string; dados?: Record<string, unknown> }[] = [];
  const emails: { para: string; assunto: string }[] = [];
  const chamadas: [string, unknown[]][] = [];
  const padrao: Record<string, unknown> = {
    evento: EVENTO, participacao: PART, minhasParticipacoes: [PART], parceirosDoEvento: [{ parceiro: 'Xis Med' }],
    resumo: { estandes: 1, areaM2: 9, investimentoCentavos: 600000, nivel: 'Bronze', credenciaisDireito: 3 },
    niveis: [{ nome: 'Bronze', investimentoMinimoCentavos: 0, beneficios: [] }, { nome: 'Prata', investimentoMinimoCentavos: 1000000, beneficios: [] }],
    estandesDe: [{ codigo: 'A1' }], perfil: { nomeExibicao: 'Xis Med' }, pedidos: [], montagem: { situacao: 'aprovada' }, equipe: [],
    contratosDe: [{ situacao: 'assinado' }], pedirServico: { id: ID(8), valorCentavos: 100000 }, salvarMontagem: { situacao: 'em_analise' },
    convidar: { id: ID(9), expiraEm: '2026-12-01T00:00:00Z' }, emitirCredencial: ID(10), criarContrato: { id: ID(11) },
    expositores: { expositores: [], plantas: [], estandes: [], segmentos: [] }, contratos: [], meusContratos: [],
  };
  const repositorio = new Proxy({}, {
    get: (_a, nome: string) => async (...args: unknown[]) => {
      chamadas.push([nome, args]);
      return nome in trocas ? trocas[nome as keyof RepositorioFeira] : (nome in padrao ? padrao[nome] : true);
    },
  }) as RepositorioFeira;
  const s = new FeiraServico({
    repositorio,
    auditoria: { registrar: async (e) => void auditoria.push(e) },
    protecao: { cifrar: (t) => new TextEncoder().encode(t), indice: (t) => new TextEncoder().encode(`h:${t}`) },
    enviarEmail: async (para, assunto) => void emails.push({ para, assunto }),
  });
  return { s, auditoria, emails, chamadas, acoes: () => auditoria.map((a) => a.acao) };
}

test('organização: visão da feira, análise de montagem e situação de pedido', async () => {
  const { s, acoes } = montar();
  assert.deepEqual(await s.feira('vera', 'cocal-2026'), { parceiros: [{ parceiro: 'Xis Med' }] });
  await s.analisarMontagem('vera', 'cocal-2026', ID(3), { aprovar: false, observacao: 'Altura acima de 4 m' });
  await s.situacaoDoPedido('vera', 'cocal-2026', ID(8), { situacao: 'confirmado' });
  assert.deepEqual(acoes(), ['montagem.analisar', 'servico.situacao']);
  await assert.rejects(montar({ evento: null }).s.feira('fora', 'cocal-2026'), codigo('nao_encontrado'));
  await assert.rejects(montar({ analisarMontagem: false }).s.analisarMontagem('vera', 'cocal-2026', ID(3), { aprovar: true }), codigo('regra'));
  await assert.rejects(montar({ situacaoDoPedido: false }).s.situacaoDoPedido('vera', 'cocal-2026', ID(8), { situacao: 'cancelado' }), codigo('nao_encontrado'));
});

test('portal: o que o expositor vê, com próximo nível e a lista do que falta', async () => {
  const { s } = montar();
  assert.equal((await s.portal('rui')).length, 1);
  const pronto = await s.participacao('rui', ID(3));
  assert.deepEqual(pronto.resumo.proximoNivel, { nome: 'Prata', faltamCentavos: 400000 });
  assert.deepEqual(pronto.pendencias, []);
  const novo = await montar({ estandesDe: [], perfil: null, montagem: null, contratosDe: [] }).s.participacao('rui', ID(3));
  assert.deepEqual(novo.pendencias, ['Escolha seu estande no mapa.', 'Monte a sua marca no app.', 'Informe como será a montagem.', 'Aguarde o contrato da organização.']);
  const meio = await montar({ montagem: { situacao: 'pendente' }, contratosDe: [{ situacao: 'enviado' }] }).s.participacao('rui', ID(3));
  assert.deepEqual(meio.pendencias, ['Envie o projeto, a ART ou RRT e aceite o termo de responsabilidade.', 'Leia e assine o contrato.']);
  await assert.rejects(montar({ participacao: null }).s.participacao('sol', ID(3)), codigo('nao_encontrado'));
  await assert.rejects(s.participacao('rui', 'x'), codigo('nao_encontrado'));
});

test('estande: reservar e liberar auditados; quem perde a corrida recebe conflito', async () => {
  const { s, acoes } = montar();
  await s.reservar('rui', ID(3), ID(4));
  await s.liberar('rui', ID(3), ID(4));
  assert.deepEqual(acoes(), ['estande.reservar', 'estande.liberar']);
  await assert.rejects(montar({ reservar: false }).s.reservar('sol', ID(3), ID(4)),
    (e: { codigo?: string; message: string }) => e.codigo === 'conflito' && /acabou de ser reservado/.test(e.message));
  await assert.rejects(montar({ liberar: false }).s.liberar('rui', ID(3), ID(4)), codigo('regra'));
});

test('marca, serviços e montagem do expositor', async () => {
  const { s, acoes, chamadas } = montar();
  await s.salvarPerfil('rui', ID(3), { nomeExibicao: 'Xis Med', publicado: true });
  assert.deepEqual(await s.pedirServico('rui', ID(3), ID(5), { quantidade: 4 }), { id: ID(8), valorCentavos: 100000 });
  await s.cancelarPedido('rui', ID(3), ID(5));
  assert.deepEqual(await s.salvarMontagem('rui', ID(3), { tipo: 'basica' }), { situacao: 'em_analise' });
  assert.deepEqual(acoes(), ['perfil_expositor.salvar', 'servico.pedir', 'servico.cancelar', 'montagem.salvar']);
  assert.deepEqual(chamadas.find(([n]) => n === 'pedirServico')?.[1].slice(2), [ID(5), 4]);
  await assert.rejects(s.salvarPerfil('rui', ID(3), {}), codigo('dados_invalidos'));
  await assert.rejects(montar({ cancelarPedido: false }).s.cancelarPedido('rui', ID(3), ID(5)), codigo('nao_encontrado'));
});

test('convite do portal e credencial da equipe', async () => {
  const { s, auditoria, emails } = montar();
  await s.convidar('vera', ID(3), { email: 'Rui@exemplo.com.br', papel: 'responsavel' });
  await s.convidar('rui', ID(3), { email: 'tina@exemplo.com.br' });
  assert.deepEqual(emails, [
    { para: 'rui@exemplo.com.br', assunto: 'Convite para a equipe: Xis Med no evento COCAL 2026' },
    { para: 'tina@exemplo.com.br', assunto: 'Convite para a equipe: Xis Med no evento COCAL 2026' },
  ]);
  assert.deepEqual(auditoria.map((a) => a.dados?.['papeis']), [['responsavel'], ['equipe']]);
  assert.ok(!JSON.stringify(auditoria).includes('@exemplo'));
  assert.deepEqual(await s.emitirCredencial('rui', ID(3), { pessoaId: ID(6) }), { id: ID(10) });
  await assert.rejects(s.emitirCredencial('rui', ID(3), {}), codigo('nao_encontrado'));
  await assert.rejects(s.emitirCredencial('rui', ID(3), null), codigo('nao_encontrado'));
  await assert.rejects(s.convidar('rui', ID(3), null), codigo('dados_invalidos'));
});

test('lista pública de expositores', async () => {
  assert.deepEqual(Object.keys(await montar().s.expositores(null, 'cocal-2026')), ['expositores', 'plantas', 'estandes', 'segmentos']);
  await assert.rejects(montar({ expositores: null }).s.expositores(null, 'rascunho'), codigo('nao_encontrado'));
});

test('contratos: criar, alterar, enviar, cancelar e as duas formas de assinar', async () => {
  const { s, auditoria, acoes, chamadas } = montar();
  assert.deepEqual(await s.contratos('vera', 'cocal-2026'), { contratos: [] });
  assert.deepEqual(await s.criarContrato('vera', 'cocal-2026', { parceiroEventoId: ID(3), modeloContratoId: ID(7) }), { id: ID(11) });
  await s.alterarContrato('vera', 'cocal-2026', ID(11), { valorCentavos: 10 });
  await s.enviarContrato('vera', ID(11));
  await s.cancelarContrato('vera', ID(11));
  await s.assinarContrato('rui', ID(11), {}, false);
  await s.assinarContrato('fin', ID(11), { referencia: 'gov.br 2027-000123' }, true);
  assert.deepEqual(acoes(), ['contrato.criar', 'contrato.alterar', 'contrato.enviar', 'contrato.cancelar', 'contrato.assinar', 'contrato.assinar']);
  assert.deepEqual(auditoria.slice(-2).map((a) => a.dados?.['via']), ['aceite_no_app', 'registro']);
  assert.deepEqual(chamadas.filter(([n]) => n === 'assinarContrato').map(([, a]) => a[2]), [null, 'gov.br 2027-000123']);
  assert.deepEqual(await s.meusContratos('rui'), { contratos: [] });
  await assert.rejects(montar({ criarContrato: 'modelo_inexistente' }).s.criarContrato('vera', 'cocal-2026', { parceiroEventoId: ID(3), modeloContratoId: ID(7) }), codigo('dados_invalidos'));
  await assert.rejects(montar({ alterarContrato: false }).s.alterarContrato('vera', 'cocal-2026', ID(11), { valorCentavos: 10 }), codigo('nao_encontrado'));
  await assert.rejects(montar({ enviarContrato: false }).s.enviarContrato('vera', ID(11)), (e: { message: string }) => /rascunho/.test(e.message));
  await assert.rejects(montar({ cancelarContrato: false }).s.cancelarContrato('vera', ID(11)), (e: { message: string }) => /assinado/.test(e.message));
  await assert.rejects(montar({ assinarContrato: false }).s.assinarContrato('rui', ID(11), {}, false), codigo('regra'));
  await assert.rejects(s.assinarContrato('fin', ID(11), {}, true), codigo('dados_invalidos'));
});

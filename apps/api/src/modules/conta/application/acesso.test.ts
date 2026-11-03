/** Cenários de 01-acesso-e-conta.feature, nos casos de uso, com portas em memória. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contaEmMemoria } from '../../../../test/apoio/conta-em-memoria.ts';
import { Autenticar, Entrar, PedirCodigo } from './acesso.ts';
import { ConcluirPrimeiroAcesso, ExcluirConta, ExportarConta, ObterConta, Sair } from './conta.ts';
import { ErroConta, VERSAO_TERMOS, validarNomeCracha } from '../domain/regras.ts';

const erro = (codigo: ErroConta['codigo']) => (e: unknown) => e instanceof ErroConta && e.codigo === codigo;

async function entrarComCodigo(d: ReturnType<typeof contaEmMemoria>, email = 'caio@exemplo.com.br') {
  await new PedirCodigo(d).executar({ email });
  const codigo = d.emailsEnviados.at(-1)?.codigo ?? '';
  return new Entrar(d).executar({ email, codigo });
}

test('pedir o código envia 6 números para o e-mail informado, normalizado', async () => {
  const d = contaEmMemoria();
  await new PedirCodigo(d).executar({ email: '  Caio@Exemplo.com.BR ' });
  assert.equal(d.emailsEnviados[0]?.email, 'caio@exemplo.com.br');
  assert.match(d.emailsEnviados[0]?.codigo ?? '', /^\d{6}$/);
});

test('e-mail em formato inválido é recusado com a mensagem do cenário', async () => {
  await assert.rejects(new PedirCodigo(contaEmMemoria()).executar({ email: 'caio@exemplo' }), (e: ErroConta) =>
    e.codigo === 'email_invalido' && /precisa ter @ e um domínio/.test(e.message));
});

test('limita a 3 pedidos de código por e-mail a cada 10 minutos', async () => {
  const d = contaEmMemoria();
  const pedir = () => new PedirCodigo(d).executar({ email: 'a@b.com' });
  await pedir(); await pedir(); await pedir();
  await assert.rejects(pedir(), erro('muitos_pedidos'));
  d.relogio.avancar(10 * 60_000 + 1);
  await assert.doesNotReject(pedir());
});

test('primeiro acesso cria a conta, registra na auditoria e pede o primeiro acesso', async () => {
  const d = contaEmMemoria();
  const r = await entrarComCodigo(d, 'novo@exemplo.com.br');
  assert.equal(r.primeiroAcesso, true);
  assert.ok(r.token.length >= 40);
  assert.equal(d.pessoasGuardadas.size, 1);
  assert.deepEqual(d.eventos.map((e) => e.acao), ['conta.criada']);
  const guardado = Buffer.from([...d.pessoasGuardadas.values()][0]?.emailCifrado ?? []).toString('utf8');
  assert.ok(!guardado.includes('novo@exemplo'), 'o e-mail não pode ficar em texto puro');
});

test('quem já tem conta entra na mesma conta, sem criar outra', async () => {
  const d = contaEmMemoria();
  await entrarComCodigo(d);
  await entrarComCodigo(d);
  assert.equal(d.pessoasGuardadas.size, 1);
});

test('código errado é inválido; vencido pede outro código', async () => {
  const d = contaEmMemoria();
  d.aleatorio.proximoCodigo = '814233';
  await new PedirCodigo(d).executar({ email: 'a@b.com' });
  await assert.rejects(new Entrar(d).executar({ email: 'a@b.com', codigo: '000000' }), (e: ErroConta) =>
    e.codigo === 'codigo_invalido' && e.message === 'Código inválido. Confira os 6 números do e-mail.');
  d.relogio.avancar(11 * 60_000);
  await assert.rejects(new Entrar(d).executar({ email: 'a@b.com', codigo: '814233' }), erro('codigo_vencido'));
});

test('código com formato errado nem chega a ser comparado', async () => {
  await assert.rejects(new Entrar(contaEmMemoria()).executar({ email: 'a@b.com', codigo: '12ab' }), erro('codigo_invalido'));
});

test('sem código pedido, a entrada é recusada', async () => {
  await assert.rejects(new Entrar(contaEmMemoria()).executar({ email: 'a@b.com', codigo: '123456' }), erro('codigo_vencido'));
});

test('5 erros bloqueiam o código, mesmo que a sexta tentativa esteja certa, e ficam na auditoria', async () => {
  const d = contaEmMemoria();
  d.aleatorio.proximoCodigo = '814233';
  await new PedirCodigo(d).executar({ email: 'a@b.com' });
  for (let i = 0; i < 4; i++) {
    await assert.rejects(new Entrar(d).executar({ email: 'a@b.com', codigo: '000000' }), erro('codigo_invalido'));
  }
  await assert.rejects(new Entrar(d).executar({ email: 'a@b.com', codigo: '000000' }), erro('codigo_bloqueado'));
  await assert.rejects(new Entrar(d).executar({ email: 'a@b.com', codigo: '814233' }), erro('codigo_bloqueado'));
  assert.ok(d.eventos.some((e) => e.acao === 'acesso.codigo_bloqueado'));
});

test('um código só serve uma vez', async () => {
  const d = contaEmMemoria();
  await new PedirCodigo(d).executar({ email: 'a@b.com' });
  const codigo = d.emailsEnviados[0]?.codigo ?? '';
  await new Entrar(d).executar({ email: 'a@b.com', codigo });
  await assert.rejects(new Entrar(d).executar({ email: 'a@b.com', codigo }), erro('codigo_vencido'));
});

test('a sessão autentica, expira e pode ser encerrada', async () => {
  const d = contaEmMemoria();
  const { token } = await entrarComCodigo(d);
  const sessao = await new Autenticar(d).executar(token);
  await new Sair(d).executar(sessao);
  await assert.rejects(new Autenticar(d).executar(token), erro('sessao_invalida'));
  await assert.rejects(new Autenticar(d).executar(undefined), erro('sessao_invalida'));
  await assert.rejects(new Autenticar(d).executar('x'.repeat(43)), erro('sessao_invalida'));

  const outro = await entrarComCodigo(d, 'b@c.com');
  d.relogio.avancar(31 * 24 * 60 * 60_000);
  await assert.rejects(new Autenticar(d).executar(outro.token), erro('sessao_invalida'));
});

test('primeiro acesso exige nome válido, aceite explícito e a versão vigente dos termos', async () => {
  const d = contaEmMemoria();
  const { token } = await entrarComCodigo(d);
  const sessao = await new Autenticar(d).executar(token);
  const concluir = (e: Record<string, unknown>) =>
    new ConcluirPrimeiroAcesso(d).executar(sessao, { nomeCracha: 'Caio Ponte', aceitaTermos: true, versaoTermos: VERSAO_TERMOS, ...e });

  await assert.rejects(concluir({ aceitaTermos: false }), (e: ErroConta) => e.message === 'Para continuar, aceite os termos.');
  await assert.rejects(concluir({ aceitaTermos: 'true' }), erro('consentimento_obrigatorio'));
  await assert.rejects(concluir({ versaoTermos: '2020-01-01' }), erro('termos_desatualizados'));
  await assert.rejects(concluir({ nomeCracha: 'Ca' }), erro('nome_invalido'));

  const conta = await concluir({ nomeCracha: '  Caio   Ponte ' });
  assert.equal(conta.nomeCracha, 'Caio Ponte');
  assert.equal(conta.primeiroAcessoPendente, false);
  assert.equal(conta.email, 'caio@exemplo.com.br');
  assert.ok(d.eventos.some((e) => e.acao === 'conta.termos_aceitos'));

  const deNovo = await entrarComCodigo(d);
  assert.equal(deNovo.primeiroAcesso, false);
});

test('baixar meus dados devolve tudo e fica na auditoria', async () => {
  const d = contaEmMemoria();
  const sessao = await new Autenticar(d).executar((await entrarComCodigo(d)).token);
  const dados = await new ExportarConta(d).executar(sessao);
  assert.equal((dados['conta'] as { email: string }).email, 'caio@exemplo.com.br');
  assert.ok('consentimentos' in dados && 'geradoEm' in dados);
  assert.ok(d.eventos.some((e) => e.acao === 'conta.exportada'));
});

test('excluir a conta apaga a pessoa, derruba as sessões e registra quem pediu', async () => {
  const d = contaEmMemoria();
  const { token } = await entrarComCodigo(d);
  const sessao = await new Autenticar(d).executar(token);
  await new ExcluirConta(d).executar(sessao);
  assert.equal(d.pessoasGuardadas.size, 0);
  await assert.rejects(new Autenticar(d).executar(token), erro('sessao_invalida'));
  assert.deepEqual(d.eventos.at(-1), { atorId: sessao.pessoaId, acao: 'conta.excluida' });
  await assert.rejects(new ObterConta(d).executar(sessao), erro('conta_inexistente'));
});

test('nome do crachá: aparas e limites', () => {
  assert.equal(validarNomeCracha(' Ana  Lia '), 'Ana Lia');
  assert.throws(() => validarNomeCracha(42), erro('nome_invalido'));
  assert.throws(() => validarNomeCracha('x'.repeat(61)), erro('nome_invalido'));
});

/** Cenários de 01-acesso-e-conta.feature na interface, buscando por papel e nome. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import { FluxoAcesso, VERSAO_TERMOS } from './FluxoAcesso';
import { sessaoEmMemoria } from './sessao';
import type { ApiAcesso, Conta } from './api';

const contaNova: Conta = { id: 'p1', email: 'novo@exemplo.com.br', nomeCracha: null, primeiroAcessoPendente: true, versaoTermos: VERSAO_TERMOS };

function apiFalsa(parcial: Partial<ApiAcesso> = {}): jest.Mocked<ApiAcesso> {
  return {
    pedirCodigo: jest.fn(async () => undefined),
    entrar: jest.fn(async () => ({ token: 't'.repeat(43), expiraEm: '2026-08-01T00:00:00Z', primeiroAcesso: true })),
    obterConta: jest.fn(async () => contaNova),
    concluirPrimeiroAcesso: jest.fn(async (d) => ({ ...contaNova, nomeCracha: d.nomeCracha, primeiroAcessoPendente: false })),
    sair: jest.fn(async () => undefined),
    ...parcial,
  } as jest.Mocked<ApiAcesso>;
}

async function montar(api = apiFalsa(), sessao = sessaoEmMemoria()) {
  const onPronto = jest.fn();
  await render(<TemaProvider><FluxoAcesso api={api} sessao={sessao} onPronto={onPronto} /></TemaProvider>);
  return { api, sessao, onPronto };
}

// No RNTL 14 os eventos são assíncronos: sempre aguardar, para não sobrepor act().
const digitar = async (rotulo: string, texto: string) => {
  await fireEvent.changeText(screen.getByLabelText(rotulo), texto);
};
const tocar = async (nome: string | RegExp) => {
  await fireEvent.press(screen.getByRole('button', { name: nome }));
};

describe('FluxoAcesso', () => {
  it('primeiro acesso: e-mail, código, nome e aceite levam até o fim e guardam a sessão', async () => {
    const { api, sessao, onPronto } = await montar();
    expect(screen.getByRole('header', { name: 'Entre para ver seu ingresso e a agenda' })).toBeOnTheScreen();

    await digitar('E-mail', ' novo@exemplo.com.br ');
    await tocar('Receber código');
    expect(await screen.findByRole('header', { name: 'Digite o código' })).toBeOnTheScreen();
    expect(api.pedirCodigo).toHaveBeenCalledWith('novo@exemplo.com.br');

    await digitar('Código de 6 números', '81-42 33');
    await tocar('Entrar');
    expect(await screen.findByRole('header', { name: 'Boas-vindas' })).toBeOnTheScreen();
    expect(api.entrar).toHaveBeenCalledWith('novo@exemplo.com.br', '814233');
    expect(sessao.atual()).toHaveLength(43);

    const caixa = screen.getByRole('checkbox', { name: /Li e aceito/ });
    expect(caixa).not.toBeChecked();
    await digitar('Nome no crachá', 'Caio Ponte');
    await fireEvent.press(caixa);
    expect(caixa).toBeChecked();
    await tocar('Continuar');
    expect(api.concluirPrimeiroAcesso).toHaveBeenCalledWith({ nomeCracha: 'Caio Ponte', aceitaTermos: true, versaoTermos: VERSAO_TERMOS });
    expect(onPronto).toHaveBeenCalledWith(expect.objectContaining({ nomeCracha: 'Caio Ponte' }));
  });

  it('quem já concluiu o primeiro acesso vai direto para o app', async () => {
    const pronta = { ...contaNova, nomeCracha: 'Ana', primeiroAcessoPendente: false };
    const { onPronto } = await montar(apiFalsa({ obterConta: jest.fn(async () => pronta) }));
    await digitar('E-mail', 'ana@exemplo.com.br');
    await tocar('Receber código');
    await digitar('Código de 6 números', '123456');
    await tocar('Entrar');
    expect(onPronto).toHaveBeenCalledWith(pronta);
  });

  it('e-mail inválido mostra o erro sem chamar a API', async () => {
    const { api } = await montar();
    await digitar('E-mail', 'caio@exemplo');
    await tocar('Receber código');
    expect(screen.getByRole('alert')).toHaveTextContent('Confira o e-mail. Ele precisa ter @ e um domínio, como nome@exemplo.com.br.');
    expect(api.pedirCodigo).not.toHaveBeenCalled();
  });

  it('erro da API no código aparece em texto e o campo é limpo', async () => {
    const api = apiFalsa({ entrar: jest.fn(async () => { throw new ErroApi(422, 'codigo_invalido', 'Código inválido. Confira os 6 números do e-mail.'); }) });
    await montar(api);
    await digitar('E-mail', 'a@b.com');
    await tocar('Receber código');
    await digitar('Código de 6 números', '000000');
    await tocar('Entrar');
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido. Confira os 6 números do e-mail.');
    expect(screen.getByLabelText('Código de 6 números')).toHaveDisplayValue('');
  });

  it('pede código de novo, avisa que enviou e permite voltar para trocar o e-mail', async () => {
    const { api } = await montar();
    await digitar('E-mail', 'a@b.com');
    await tocar('Receber código');
    await tocar('Enviar outro código');
    expect(await screen.findByText('Enviamos um novo código.')).toBeOnTheScreen();
    expect(api.pedirCodigo).toHaveBeenCalledTimes(2);
    await tocar('Voltar e trocar o e-mail');
    expect(await screen.findByRole('header', { name: 'Entre para ver seu ingresso e a agenda' })).toBeOnTheScreen();
  });

  it('primeiro acesso não continua sem nome válido e sem o aceite', async () => {
    const { api } = await montar();
    await digitar('E-mail', 'a@b.com');
    await tocar('Receber código');
    await digitar('Código de 6 números', '123456');
    await tocar('Entrar');
    await screen.findByRole('header', { name: 'Boas-vindas' });
    await digitar('Nome no crachá', 'Ca');
    await tocar('Continuar');
    expect(screen.getByText('Escreva o nome do crachá com 3 a 60 letras.')).toBeOnTheScreen();
    expect(screen.getByText('Para continuar, aceite os termos.')).toBeOnTheScreen();
    expect(api.concluirPrimeiroAcesso).not.toHaveBeenCalled();
  });

  it('sem internet ao pedir o código, a mensagem é clara', async () => {
    await montar(apiFalsa({ pedirCodigo: jest.fn(async () => { throw new ErroApi(0, 'sem_conexao', 'Sem internet. Confira a conexão e tente de novo.'); }) }));
    await digitar('E-mail', 'a@b.com');
    await tocar('Receber código');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem internet. Confira a conexão e tente de novo.');
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { App } from './App';
import { sessaoEmMemoria } from '../features/acesso/sessao';
import type { ApiAcesso, Conta } from '../features/acesso/api';

const conta: Conta = { id: 'p1', email: 'a@b.com', nomeCracha: 'Caio Ponte', primeiroAcessoPendente: false, versaoTermos: '2026-11-03' };

const api = (obterConta: ApiAcesso['obterConta']): jest.Mocked<ApiAcesso> => ({
  pedirCodigo: jest.fn(),
  entrar: jest.fn(),
  obterConta: jest.fn(obterConta),
  concluirPrimeiroAcesso: jest.fn(),
  sair: jest.fn(async () => undefined),
}) as jest.Mocked<ApiAcesso>;

describe('App', () => {
  it('com sessão válida, abre direto no app e sai apagando a sessão', async () => {
    const sessao = sessaoEmMemoria('t'.repeat(43));
    const falsa = api(async () => conta);
    await render(<App api={falsa} sessao={sessao} />);
    expect(await screen.findByRole('header', { name: 'Olá, Caio Ponte' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('header', { name: 'Entre para ver seu ingresso e a agenda' })).toBeOnTheScreen();
    expect(falsa.sair).toHaveBeenCalled();
    expect(sessao.atual()).toBeNull();
  });

  it('sessão vencida é apagada e leva ao login', async () => {
    const sessao = sessaoEmMemoria('velho'.repeat(10));
    await render(<App api={api(async () => { throw new Error('401'); })} sessao={sessao} />);
    expect(await screen.findByRole('header', { name: 'Entre para ver seu ingresso e a agenda' })).toBeOnTheScreen();
    expect(sessao.atual()).toBeNull();
  });

  it('sem sessão, começa no login sem chamar a API', async () => {
    const falsa = api(async () => conta);
    await render(<App api={falsa} sessao={sessaoEmMemoria()} />);
    expect(await screen.findByRole('header', { name: 'Entre para ver seu ingresso e a agenda' })).toBeOnTheScreen();
    expect(falsa.obterConta).not.toHaveBeenCalled();
  });

  it('primeiro acesso pendente volta para o fluxo de acesso', async () => {
    await render(<App api={api(async () => ({ ...conta, primeiroAcessoPendente: true }))} sessao={sessaoEmMemoria('t'.repeat(43))} />);
    expect(await screen.findByRole('header', { name: 'Entre para ver seu ingresso e a agenda' })).toBeOnTheScreen();
  });
});

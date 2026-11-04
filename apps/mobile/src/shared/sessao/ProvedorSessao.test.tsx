import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErroApi } from '../api/cliente';
import type { Requisitor } from '../api/cliente';
import { cofreEmMemoria } from '../armazenamento/cofre';
import { sessaoEmMemoria } from '../../features/acesso/sessao';
import type { ApiAcesso, Conta } from '../../features/acesso/api';
import { ProvedorSessao, useSessao } from './ProvedorSessao';

const conta: Conta = { id: 'p1', email: 'ana@exemplo.com.br', nomeCracha: 'Ana', primeiroAcessoPendente: false, versaoTermos: 'v' };
const requisitar = (async () => ({ status: 200, dados: undefined, etag: null })) as Requisitor;

function api(obterConta: () => Promise<Conta>): ApiAcesso {
  return { pedirCodigo: jest.fn(), entrar: jest.fn(), obterConta: jest.fn(obterConta), concluirPrimeiroAcesso: jest.fn(), sair: jest.fn(async () => undefined) } as unknown as ApiAcesso;
}

function Espiao() {
  const { estado, sair } = useSessao();
  return <Text onPress={() => void sair()}>{estado.tipo === 'logado' ? `logado ${estado.conta.nomeCracha}` : estado.tipo}</Text>;
}

async function montar(a: ApiAcesso, token: string | null, cofre = cofreEmMemoria()) {
  const sessao = sessaoEmMemoria(token);
  await render(<ProvedorSessao api={a} requisitar={requisitar} sessao={sessao} cofre={cofre}><Espiao /></ProvedorSessao>);
  return { sessao, cofre };
}

describe('ProvedorSessao', () => {
  it('sem token, fica anônimo', async () => {
    await montar(api(async () => conta), null);
    expect(await screen.findByText('anonimo')).toBeTruthy();
  });

  it('token válido entra e guarda a conta', async () => {
    const { cofre } = await montar(api(async () => conta), 'tok');
    expect(await screen.findByText('logado Ana')).toBeTruthy();
    expect(cofre.conteudo.has('conta')).toBe(true);
  });

  it('token recusado apaga a sessão', async () => {
    const { sessao } = await montar(api(async () => { throw new ErroApi(401, 'nao_autenticado', 'x'); }), 'tok');
    expect(await screen.findByText('anonimo')).toBeTruthy();
    expect(sessao.atual()).toBeNull();
  });

  it('sem internet, entra com a conta salva', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('conta', JSON.stringify(conta));
    const { sessao } = await montar(api(async () => { throw new ErroApi(0, 'sem_conexao', 'x'); }), 'tok', cofre);
    expect(await screen.findByText('logado Ana')).toBeTruthy();
    expect(sessao.atual()).toBe('tok');
  });

  it('sair limpa sessão, conta e favoritos', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('favoritos-cocal-2026', '{}');
    const { sessao } = await montar(api(async () => conta), 'tok', cofre);
    await fireEvent.press(await screen.findByText('logado Ana'));
    expect(await screen.findByText('anonimo')).toBeTruthy();
    expect(sessao.atual()).toBeNull();
    expect(cofre.conteudo.size).toBe(0);
  });
});

/** Cenários de 05-assistente-guiado.feature. */
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import { TelaAssistente } from './TelaAssistente';
import { ASSISTENTE } from './fixtures';
import type { Assistente } from './modelo';
import type { Avaliacao } from './sincronizacao';

function servicoFalso({ salvo = null as Assistente | null, online = true } = {}) {
  const avaliacoes: Avaliacao[] = [];
  return {
    avaliacoes,
    servico: {
      salvo: async () => salvo,
      sincronizar: async () => {
        if (!online) throw new ErroApi(0, 'sem_conexao', 'x');
        return ASSISTENTE;
      },
      avaliar: async (a: Avaliacao) => void avaliacoes.push(a),
      enviarPendentes: async () => 0,
    },
  };
}

async function montar(s = servicoFalso(), abrirLink = jest.fn()) {
  await render(<TemaProvider><TelaAssistente servico={s.servico} abrirLink={abrirLink} onFechar={jest.fn()} /></TemaProvider>);
  await screen.findByRole('header', { name: /Pergunta 1 de 2/ });
  return { ...s, abrirLink };
}

beforeEach(() => jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('TelaAssistente', () => {
  it('chega à resposta com a data da revisão e pergunta se ajudou', async () => {
    await montar();
    expect(screen.getByRole('header', { name: 'Pergunta 1 de 2. Sobre o que é a sua dúvida?' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Acessibilidade' }));
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Pergunta 2 de 2. Qual recurso você procura?');
    await fireEvent.press(screen.getByRole('button', { name: 'Intérprete de Libras' }));
    expect(screen.getByRole('header', { name: 'Intérprete de Libras' })).toBeTruthy();
    expect(screen.getByText('Revisada pela organização em 1 de novembro de 2026.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Isso respondeu sua dúvida?' })).toBeTruthy();
  });

  it('voltar mostra a pergunta anterior com a escolha marcada', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Acessibilidade' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('header', { name: /Pergunta 1 de 2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Acessibilidade' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'Certificado' }).props.accessibilityState).toEqual({ selected: false });
  });

  it('nenhuma opção serve: mostra os canais e abre o link certo', async () => {
    const { abrirLink } = await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Não encontrei. Falar com a organização' }));
    expect(screen.getByRole('header', { name: 'Falar com a organização' })).toBeTruthy();
    expect(screen.getByText('Ao lado da entrada principal')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar e-mail: E-mail da organização' }));
    expect(abrirLink).toHaveBeenCalledWith('mailto:contato@exemplo.com.br');
  });

  it('"Não" registra a avaliação sem dados pessoais e leva aos canais', async () => {
    const { avaliacoes } = await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Certificado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Não' }));
    expect(avaliacoes).toEqual([{ versao: 1, respostaId: 'r-certificado', util: false }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Falar com a organização' }));
    expect(screen.getByRole('header', { name: 'Falar com a organização' })).toBeTruthy();
  });

  it('"Sim" agradece e permite outra pergunta', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Certificado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sim' }));
    expect(screen.getByText('Que bom! Obrigado por avisar.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fazer outra pergunta' }));
    expect(screen.getByRole('header', { name: /Pergunta 1 de 2/ })).toBeTruthy();
  });

  it('sem internet, percorre o assistente salvo até a resposta', async () => {
    await montar(servicoFalso({ salvo: ASSISTENTE, online: false }));
    await fireEvent.press(screen.getByRole('button', { name: 'Acessibilidade' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Audiodescrição' }));
    expect(screen.getByText('Retire o fone no balcão.')).toBeTruthy();
  });

  it('sem internet e sem nada salvo, explica', async () => {
    const s = servicoFalso({ online: false });
    await render(<TemaProvider><TelaAssistente servico={s.servico} abrirLink={jest.fn()} onFechar={jest.fn()} /></TemaProvider>);
    expect(await screen.findByText(/Precisamos de internet uma vez/)).toBeTruthy();
  });
});

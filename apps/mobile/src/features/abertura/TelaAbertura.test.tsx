import { fireEvent, render, screen } from '@testing-library/react-native';
import { xilos } from '@acessa-evento/xilos';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { PEDIDOS, TelaAbertura } from './TelaAbertura';

describe('TelaAbertura', () => {
  it('apresenta o app com a gravura descrita e diz o que pede e o que não pede', async () => {
    await render(<TemaProvider><TelaAbertura onComecar={jest.fn()} onExplorar={jest.fn()} /></TemaProvider>);
    expect(screen.getByRole('header', { name: 'Acessa Evento' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: xilos.boasVindas.alt })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'O que o app pede, e por quê' })).toBeOnTheScreen();
    for (const p of PEDIDOS) {
      expect(screen.getByText(p.titulo)).toBeOnTheScreen();
      expect(screen.getByText(p.texto)).toBeOnTheScreen();
    }
    // Os símbolos são enfeite: o texto ao lado já diz tudo, então só a cena é imagem para o leitor de tela.
    expect(screen.getAllByRole('image')).toHaveLength(1);
  });

  it('não pede permissão nenhuma: só leva para entrar ou para os eventos', async () => {
    const [onComecar, onExplorar] = [jest.fn(), jest.fn()];
    await render(<TemaProvider><TelaAbertura onComecar={onComecar} onExplorar={onExplorar} /></TemaProvider>);
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar ou criar conta' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver eventos sem entrar' }));
    expect([onComecar.mock.calls.length, onExplorar.mock.calls.length]).toEqual([1, 1]);
  });
});

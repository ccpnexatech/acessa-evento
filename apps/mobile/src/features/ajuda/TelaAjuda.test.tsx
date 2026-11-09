import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { TelaAjuda } from './TelaAjuda';

describe('TelaAjuda', () => {
  it('escolhe o alto contraste como um grupo de opções', async () => {
    await render(<TemaProvider><TelaAjuda nome="Ana" onSair={jest.fn()} /></TemaProvider>);
    expect(screen.getByRole('radio', { name: 'Como o sistema', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Sempre ligado' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Sempre ligado', checked: true })).toBeTruthy());
    expect(screen.getByRole('radio', { name: 'Como o sistema', checked: false })).toBeTruthy();
  });

  it('mostra quem entrou e sai', async () => {
    const onSair = jest.fn();
    await render(<TemaProvider><TelaAjuda nome="Ana" onSair={onSair} /></TemaProvider>);
    expect(screen.getByText('Você entrou como Ana.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    expect(onSair).toHaveBeenCalled();
  });
});

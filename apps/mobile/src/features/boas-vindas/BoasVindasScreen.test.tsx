import { render, screen } from '@testing-library/react-native';
import { cores } from '@acessa-evento/tokens';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { BoasVindasScreen } from './BoasVindasScreen';

describe('BoasVindasScreen', () => {
  it('anuncia o nome do app como título para o leitor de tela', async () => {
    await render(<TemaProvider><BoasVindasScreen /></TemaProvider>);
    expect(screen.getByRole('header', { name: 'Acessa Evento' })).toBeOnTheScreen();
  });

  it('usa as cores do alto contraste quando a pessoa escolhe', async () => {
    await render(<TemaProvider altoContraste><BoasVindasScreen /></TemaProvider>);
    expect(screen.getByTestId('tela-boas-vindas')).toHaveStyle({ backgroundColor: cores['alto-contraste'].surface000 });
    expect(screen.getByRole('header')).toHaveStyle({ color: cores['alto-contraste'].ink900 });
  });
});

import { AccessibilityInfo } from 'react-native';
import { render } from '@testing-library/react-native';
import { TemaProvider } from '../../shared/tema/TemaProvider';
import { AvisoConexao } from './componentes';

describe('AvisoConexao', () => {
  beforeEach(() => jest.clearAllMocks());

  it('anuncia a queda de conexão ao leitor de tela do iPhone', async () => {
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    await render(<TemaProvider><AvisoConexao conexao="offline" pendentes={2} salvaHaTempo /></TemaProvider>);
    expect(anunciar).toHaveBeenCalledWith('Sem internet. 2 favoritos serão enviados quando a conexão voltar.');
  });

  it('não anuncia a sincronização de rotina', async () => {
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    await render(<TemaProvider><AvisoConexao conexao="sincronizando" pendentes={0} salvaHaTempo={false} /></TemaProvider>);
    expect(anunciar).not.toHaveBeenCalled();
  });
});

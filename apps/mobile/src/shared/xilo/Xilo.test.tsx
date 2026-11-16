import { render, screen } from '@testing-library/react-native';
import { cores } from '@acessa-evento/tokens';
import { xilos } from '@acessa-evento/xilos';
import { TemaProvider } from '../tema/TemaProvider';
import { NOMES_DE_XILO, Xilo } from './Xilo';

describe('Xilo', () => {
  it('peça que informa leva o texto alternativo do manifesto e a tinta do tema', async () => {
    await render(<TemaProvider><Xilo nome="boasVindas" largura={240} /></TemaProvider>);
    const imagem = screen.getByRole('image', { name: xilos.boasVindas.alt });
    expect(imagem).toHaveStyle({ width: 240, height: 240, tintColor: cores.light.primary600 });
  });

  it('muda de tinta com o tema e aceita uma cor própria', async () => {
    const t = await render(<TemaProvider altoContraste><Xilo nome="semInternet" largura={100} /></TemaProvider>);
    expect(screen.getByRole('image')).toHaveStyle({ tintColor: cores['alto-contraste'].primary600 });
    await t.unmount();
    await render(<TemaProvider><Xilo nome="simboloAviso" largura={24} cor="#123456" /></TemaProvider>);
    expect(screen.getByRole('image')).toHaveStyle({ tintColor: '#123456' });
  });

  it('enfeite fica fora do leitor de tela e respeita a proporção da peça', async () => {
    await render(<TemaProvider><Xilo nome="faixaBandeirolas" largura={320} decorativa /></TemaProvider>);
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.getByTestId('xilo-faixaBandeirolas', { includeHiddenElements: true })).toHaveStyle({ width: 320, height: 52 });
  });

  it('toda peça do app existe no manifesto, com texto alternativo', () => {
    for (const nome of NOMES_DE_XILO) expect(xilos[nome].alt.length).toBeGreaterThan(3);
  });
});

import { AccessibilityInfo, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { cofreEmMemoria } from '../armazenamento/cofre';
import { contornoCartao, contrasteAtivo, resolverTema, TemaProvider, useTema } from './TemaProvider';

describe('resolverTema', () => {
  it.each([
    ['light', false, 'light'],
    ['dark', false, 'dark'],
    [null, false, 'light'],
    ['dark', true, 'alto-contraste'],
    ['light', true, 'alto-contraste'],
  ] as const)('sistema %s, alto contraste %s → %s', (esquema, alto, esperado) => {
    expect(resolverTema(esquema, alto)).toBe(esperado);
  });
});

describe('useTema', () => {
  it('avisa quando falta o provider', async () => {
    const SemProvider = () => {
      useTema();
      return null;
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<SemProvider />)).rejects.toThrow('dentro de <TemaProvider>');
  });
});

describe('contrasteAtivo', () => {
  it.each([
    ['sistema', true, true],
    ['sistema', false, false],
    ['ligado', false, true],
    ['desligado', true, false],
  ] as const)('preferência %s, sistema %s → %s', (p, sistema, esperado) => {
    expect(contrasteAtivo(p, sistema)).toBe(esperado);
  });
});

function Espiao() {
  const { tema, definirContraste } = useTema();
  return <Text onPress={() => definirContraste('ligado')}>{tema}</Text>;
}

describe('TemaProvider', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(false);
  });

  it('segue o "Aumentar contraste" do aparelho', async () => {
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
    await render(<TemaProvider><Espiao /></TemaProvider>);
    expect(await screen.findByText('alto-contraste')).toBeTruthy();
  });

  it('lembra a escolha da pessoa no cofre', async () => {
    const cofre = cofreEmMemoria();
    await render(<TemaProvider cofre={cofre}><Espiao /></TemaProvider>);
    await fireEvent.press(await screen.findByText('light'));
    expect(screen.getByText('alto-contraste')).toBeTruthy();
    expect(await cofre.ler('preferencia-contraste')).toBe('ligado');
  });

  it('abre com a escolha salva', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('preferencia-contraste', 'ligado');
    await render(<TemaProvider cofre={cofre}><Espiao /></TemaProvider>);
    expect(await screen.findByText('alto-contraste')).toBeTruthy();
  });
});

describe('contornoCartao', () => {
  it('só desenha borda quando cartão e fundo têm a mesma cor', () => {
    const { cores } = jest.requireActual<typeof import('@acessa-evento/tokens')>('@acessa-evento/tokens');
    expect(contornoCartao(cores.light)).toBeNull();
    expect(contornoCartao(cores['alto-contraste'])).toEqual({ borderWidth: 2, borderColor: '#000000' });
  });
});

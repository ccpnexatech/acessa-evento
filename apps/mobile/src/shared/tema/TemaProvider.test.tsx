import { render } from '@testing-library/react-native';
import { resolverTema, useTema } from './TemaProvider';

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

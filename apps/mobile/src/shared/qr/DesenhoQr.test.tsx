import { render, screen } from '@testing-library/react-native';
import { DesenhoQr, faixas, matrizQr } from './DesenhoQr';

describe('DesenhoQr', () => {
  it('gera uma matriz quadrada com os padrões de posição nos cantos', () => {
    const m = matrizQr('AE1.teste.assinatura');
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((l) => l.length === m.length)).toBe(true);
    expect(m[0]?.slice(0, 7)).toEqual([true, true, true, true, true, true, true]);
  });

  it('junta módulos vizinhos em faixas', () => {
    expect(faixas([true, true, false, true, false, false, true, true, true])).toEqual([
      { inicio: 0, tamanho: 2 }, { inicio: 3, tamanho: 1 }, { inicio: 6, tamanho: 3 },
    ]);
    expect(faixas([false, false])).toEqual([]);
  });

  it('é uma imagem com nome para o leitor de tela', async () => {
    await render(<DesenhoQr valor="AE1.a.b" tamanho={200} rotulo="QR do ingresso" />);
    expect(screen.getByRole('image', { name: 'QR do ingresso' })).toBeTruthy();
  });
});

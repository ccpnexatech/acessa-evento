import { formatarCartao, luhnValido, periodo, reais } from './modelo';

describe('modelo da inscrição', () => {
  it('formata valores em reais', () => {
    expect(reais(45000).replace(/\s/g, ' ')).toBe('R$ 450,00');
  });

  it('escreve o período do evento por extenso', () => {
    expect(periodo('2026-07-01', '2026-07-03')).toBe('1 a 3 de julho de 2026');
    expect(periodo('2026-07-30', '2026-08-02')).toBe('30 de julho a 2 de agosto de 2026');
    expect(periodo('2026-07-01', '2026-07-01')).toBe('1 de julho de 2026');
  });

  it('agrupa o cartão de 4 em 4 e confere com Luhn', () => {
    expect(formatarCartao('4242a4242424242424242')).toBe('4242 4242 4242 4242 424');
    expect(luhnValido('4242 4242 4242 4242')).toBe(true);
    expect(luhnValido('4242 4242 4242 4241')).toBe(false);
    expect(luhnValido('42')).toBe(false);
  });
});

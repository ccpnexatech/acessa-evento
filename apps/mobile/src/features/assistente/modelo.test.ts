import { dataRevisao, linkCanal, perguntasRestantes, progresso } from './modelo';
import { ASSISTENTE } from './fixtures';

const g = ASSISTENTE.grafo;

describe('modelo do assistente', () => {
  it('conta "Pergunta n de m" pelo caminho mais longo', () => {
    expect(progresso(g, 'inicio', 0)).toEqual({ atual: 1, total: 2 });
    expect(progresso(g, 'acessibilidade', 1)).toEqual({ atual: 2, total: 2 });
    expect(perguntasRestantes(g, 'r-libras')).toBe(0);
    expect(perguntasRestantes(g, 'nao-existe')).toBe(0);
  });

  it('não trava se o grafo vier com ciclo', () => {
    const ciclo = { inicio: 'a', nos: { a: { tipo: 'pergunta' as const, texto: 'a', opcoes: [{ rotulo: 'b', destino: 'b' }, { rotulo: 'a', destino: 'a' }] }, b: { tipo: 'pergunta' as const, texto: 'b', opcoes: [{ rotulo: 'a', destino: 'a' }, { rotulo: 'b', destino: 'b' }] } } };
    expect(perguntasRestantes(ciclo, 'a')).toBeGreaterThan(0);
  });

  it('data da revisão e links dos canais', () => {
    expect(dataRevisao('2026-11-01')).toBe('1 de novembro de 2026');
    expect(ASSISTENTE.canais.map(linkCanal)).toEqual([null, 'mailto:contato@exemplo.com.br', 'https://wa.me/5585900000000']);
    expect(linkCanal({ tipo: 'telefone', rotulo: 't', valor: '(85) 3000-0000' })).toBe('tel:+8530000000');
  });
});

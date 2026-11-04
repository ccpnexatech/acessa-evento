import { diaInicial, diaLocal, dias, filtrar, hora, secoes } from './modelo';
import type { Atividade } from './modelo';

const FUSO = 'America/Fortaleza';
const at = (id: string, inicio: string, fim: string, extra: Partial<Atividade> = {}): Atividade => ({
  id, titulo: `Atividade ${id}`, resumo: null, inicio, fim, recursos: [], sala: null, palestrantes: [], ...extra,
});

const lista = [
  at('1', '2026-07-01T12:00:00Z', '2026-07-01T13:00:00Z', { recursos: ['libras', 'legenda'], titulo: 'Abertura do evento' }),
  at('2', '2026-07-01T13:30:00Z', '2026-07-01T14:15:00Z', { recursos: ['audiodescricao'], palestrantes: [{ nome: 'Ana Ribeiro', cargo: null }] }),
  at('3', '2026-07-02T02:30:00Z', '2026-07-02T03:00:00Z', { titulo: 'Sessão noturna de comunicação' }),
  at('4', '2026-07-03T19:00:00Z', '2026-07-03T20:00:00Z', { recursos: ['libras'] }),
];

describe('dias e horários no fuso do evento', () => {
  it('usa o fuso do evento, não o do aparelho', () => {
    expect(diaLocal('2026-07-02T02:30:00Z', FUSO)).toBe('2026-07-01');
    expect(hora('2026-07-01T12:00:00Z', FUSO)).toBe('09:00');
  });

  it('lista os dias com nome curto e extenso', () => {
    const d = dias(lista, FUSO);
    expect(d.map((x) => x.id)).toEqual(['2026-07-01', '2026-07-03']);
    expect(d[0]).toMatchObject({ semana: 'Qua', data: '1 jul' });
    expect(d[0]?.extenso).toMatch(/quarta-feira, 1 de julho/);
  });

  it('abre no dia de hoje durante o evento e no primeiro dia antes dele', () => {
    const d = dias(lista, FUSO);
    expect(diaInicial(d, new Date('2026-07-03T15:00:00Z'), FUSO)).toBe('2026-07-03');
    expect(diaInicial(d, new Date('2026-06-20T15:00:00Z'), FUSO)).toBe('2026-07-01');
    expect(diaInicial([], new Date(), FUSO)).toBeNull();
  });
});

describe('filtrar', () => {
  const nada = { busca: '', recursos: [], soFavoritas: false } as const;
  it('busca no título e nos palestrantes, sem diferenciar acento', () => {
    expect(filtrar(lista, { ...nada, busca: 'comunicacao' }, new Set()).map((a) => a.id)).toEqual(['3']);
    expect(filtrar(lista, { ...nada, busca: 'ribeiro' }, new Set()).map((a) => a.id)).toEqual(['2']);
  });
  it('exige todos os recursos marcados', () => {
    expect(filtrar(lista, { ...nada, recursos: ['libras'] }, new Set()).map((a) => a.id)).toEqual(['1', '4']);
    expect(filtrar(lista, { ...nada, recursos: ['libras', 'legenda'] }, new Set()).map((a) => a.id)).toEqual(['1']);
  });
  it('mostra só as favoritas quando pedido', () => {
    expect(filtrar(lista, { ...nada, soFavoritas: true }, new Set(['2'])).map((a) => a.id)).toEqual(['2']);
  });
});

describe('secoes', () => {
  it('separa em Agora, A seguir e Já passou, sem seções vazias', () => {
    const r = secoes(lista.slice(0, 2), new Date('2026-07-01T12:30:00Z'));
    expect(r.map((s) => [s.titulo, s.atividades.map((a) => a.id)])).toEqual([['Agora', ['1']], ['A seguir', ['2']]]);
    expect(secoes(lista.slice(0, 1), new Date('2026-07-01T13:00:00Z')).map((s) => s.titulo)).toEqual(['Já passou']);
  });
});

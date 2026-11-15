/** Contrato com a API e com o banco: os mesmos casos de apps/api/src/modules/acessos/domain/acessos.test.ts. */
import { decidir } from './regra';
import type { Excecao, Regra } from './regra';

const AGORA = Date.parse('2027-03-01T12:00:00Z');

describe('regra de acesso no aparelho', () => {
  const [geral, vip, palco] = [{ id: 'geral', aberta: true }, { id: 'vip', aberta: false }, { id: 'palco', aberta: false }];
  const regras: Regra[] = [
    { zonaId: 'vip', categoria: 'palestrante', de: null, ate: null },
    { zonaId: 'palco', categoria: 'seguranca', de: null, ate: null },
    { zonaId: 'palco', categoria: 'montagem', de: '2027-02-27T00:00:00Z', ate: '2027-03-01T00:00:00Z' },
  ];
  const excecoes: Excecao[] = [
    { credencialId: 'caio', zonaId: 'vip', efeito: 'permite' },
    { credencialId: 'duda', zonaId: 'palco', efeito: 'nega' },
  ];
  const caio = { id: 'caio', categoria: 'congressista', revogada: false };
  const duda = { id: 'duda', categoria: 'seguranca', revogada: false };
  const rui = { id: 'rui', categoria: 'seguranca', revogada: false };
  const montador = { id: 'eva', categoria: 'montagem', revogada: false };
  const d = (c: typeof caio, z: typeof geral | null | undefined, quando = AGORA) => decidir(c, z, regras, excecoes, quando);

  it('entrada do evento, zona aberta e zona sem regra', () => {
    expect(d(caio, null)).toEqual({ entra: true });
    expect(d(caio, geral)).toEqual({ entra: true });
    expect(d(caio, palco)).toEqual({ entra: false, motivo: 'sem_regra' });
    expect(d(rui, palco)).toEqual({ entra: true });
    expect(d(rui, vip)).toEqual({ entra: false, motivo: 'sem_regra' });
  });

  it('exceção pessoal ganha da regra, nos dois sentidos', () => {
    expect(d(caio, vip)).toEqual({ entra: true });
    expect(d(duda, palco)).toEqual({ entra: false, motivo: 'excecao' });
  });

  it('janela de horário: antes, durante e depois', () => {
    expect(d(montador, palco, Date.parse('2027-02-28T10:00:00Z'))).toEqual({ entra: true });
    expect(d(montador, palco)).toEqual({ entra: false, motivo: 'sem_regra' });
    expect(d(montador, palco, Date.parse('2027-02-26T10:00:00Z'))).toEqual({ entra: false, motivo: 'sem_regra' });
  });

  it('credencial cancelada nunca entra; zona que o aparelho não conhece também não', () => {
    expect(d({ ...caio, revogada: true }, null)).toEqual({ entra: false, motivo: 'credencial_revogada' });
    expect(d({ ...caio, revogada: true }, vip)).toEqual({ entra: false, motivo: 'credencial_revogada' });
    expect(d(caio, undefined)).toEqual({ entra: false, motivo: 'zona_desconhecida' });
  });
});

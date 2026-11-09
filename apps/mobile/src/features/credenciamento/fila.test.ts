import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { FilaCheckins, LOTE, semConexao } from './fila';

const c = (n: number) => ({ id: `id-${n}`, ingressoId: `i-${n}`, portao: 'Portão 1', metodo: 'qr' as const, feitoEm: '2026-07-01T11:00:00.000Z' });

describe('FilaCheckins', () => {
  it('guarda antes de enviar, envia em lotes e sobrevive a reabrir o app', async () => {
    const cofre = cofreEmMemoria();
    const fila = new FilaCheckins(cofre, 'cocal-2026');
    await fila.carregar();
    for (let i = 0; i < LOTE + 5; i++) await fila.adicionar(c(i));
    const outra = new FilaCheckins(cofre, 'cocal-2026');
    await outra.carregar();
    expect(outra.pendentes).toHaveLength(LOTE + 5);
    const lotes: number[] = [];
    const requisitar = (async (_m: string, _c: string, o?: { corpo?: { checkins: unknown[] } }) => {
      lotes.push(o?.corpo?.checkins.length ?? 0);
      return { status: 200, dados: undefined, etag: null };
    }) as Requisitor;
    expect(await outra.sincronizar(requisitar, 'cocal-2026')).toBe(LOTE + 5);
    expect(lotes).toEqual([LOTE, 5]);
    expect(outra.pendentes).toHaveLength(0);
    expect(outra.feitos).toHaveLength(LOTE + 5);
  });

  it('sem internet, mantém tudo na fila', async () => {
    const fila = new FilaCheckins(cofreEmMemoria(), 'cocal-2026');
    await fila.adicionar(c(1));
    const requisitar = (async () => { throw new ErroApi(0, 'sem_conexao', 'x'); }) as Requisitor;
    await expect(fila.sincronizar(requisitar, 'cocal-2026')).rejects.toThrow();
    expect(fila.pendentes).toHaveLength(1);
    await fila.limpar();
    expect(fila.pendentes).toHaveLength(0);
  });

  it('semConexao reconhece rede e 5xx', () => {
    expect(semConexao(new ErroApi(0, 'x', 'x'))).toBe(true);
    expect(semConexao(new ErroApi(503, 'x', 'x'))).toBe(true);
    expect(semConexao(new ErroApi(403, 'x', 'x'))).toBe(false);
    expect(semConexao(new Error('x'))).toBe(false);
  });
});

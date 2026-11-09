import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { eventosDaEquipe } from './equipe';

describe('eventosDaEquipe', () => {
  it('busca, guarda e usa o guardado sem internet', async () => {
    const cofre = cofreEmMemoria();
    const online = (async () => ({ status: 200, dados: { eventos: [{ slug: 'cocal-2026', nome: 'COCAL 2026' }] }, etag: null })) as Requisitor;
    const offline = (async () => { throw new ErroApi(0, 'sem_conexao', 'x'); }) as Requisitor;
    expect(await eventosDaEquipe(offline, cofre)).toEqual([]);
    expect(await eventosDaEquipe(online, cofre)).toHaveLength(1);
    expect(await eventosDaEquipe(offline, cofre)).toEqual([{ slug: 'cocal-2026', nome: 'COCAL 2026' }]);
  });
});

import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { AgendaOffline, FavoritosOffline } from './sincronizacao';
import type { Agenda } from './modelo';

const agenda: Agenda = {
  versao: 'v1',
  evento: { id: 'e', slug: 'cocal-2026', nome: 'COCAL 2026', inicio: '2026-07-01', fim: '2026-07-03', local: 'Fortaleza', fuso: 'America/Fortaleza' },
  atividades: [],
};
const offline = () => new ErroApi(0, 'sem_conexao', 'sem rede');

type Chamada = { metodo: string; caminho: string; cabecalhos?: Record<string, string> };
function requisitorFalso(responder: (c: Chamada) => { status: number; dados?: unknown } | Error) {
  const chamadas: Chamada[] = [];
  const requisitar = (async (metodo: string, caminho: string, opcoes?: { cabecalhos?: Record<string, string> }) => {
    const c = { metodo, caminho, ...(opcoes?.cabecalhos ? { cabecalhos: opcoes.cabecalhos } : {}) };
    chamadas.push(c);
    const r = responder(c);
    if (r instanceof Error) throw r;
    return { status: r.status, dados: r.dados, etag: null };
  }) as Requisitor;
  return { requisitar, chamadas };
}

describe('AgendaOffline', () => {
  it('primeira vez baixa e salva; depois manda a versão e aproveita o 304', async () => {
    const cofre = cofreEmMemoria();
    const rede = requisitorFalso((c) => (c.cabecalhos?.['if-none-match'] ? { status: 304 } : { status: 200, dados: agenda }));
    const a = new AgendaOffline(rede.requisitar, cofre, () => new Date('2026-07-01T12:00:00Z'));
    expect(await a.salva('cocal-2026')).toBeNull();
    await a.sincronizar('cocal-2026');
    const segunda = await a.sincronizar('cocal-2026');
    expect(rede.chamadas[1]?.cabecalhos).toEqual({ 'if-none-match': '"v1"' });
    expect(segunda.agenda.evento.nome).toBe('COCAL 2026');
    expect((await a.salva('cocal-2026'))?.salvaEm).toBe('2026-07-01T12:00:00.000Z');
  });

  it('sem rede, mantém o que estava salvo e avisa com sem_conexao', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('agenda-cocal-2026', JSON.stringify({ agenda, salvaEm: 'ontem' }));
    const a = new AgendaOffline(requisitorFalso(() => offline()).requisitar, cofre);
    await expect(a.sincronizar('cocal-2026')).rejects.toMatchObject({ codigo: 'sem_conexao' });
    expect((await a.salva('cocal-2026'))?.agenda.versao).toBe('v1');
  });

  it('arquivo corrompido é descartado em vez de quebrar o app', async () => {
    const cofre = cofreEmMemoria();
    await cofre.gravar('agenda-cocal-2026', '{quebrado');
    expect(await new AgendaOffline(requisitorFalso(() => offline()).requisitar, cofre).salva('cocal-2026')).toBeNull();
    expect(cofre.conteudo.has('agenda-cocal-2026')).toBe(false);
  });

  it('resposta vazia vira erro claro', async () => {
    const a = new AgendaOffline(requisitorFalso(() => ({ status: 200 })).requisitar, cofreEmMemoria());
    await expect(a.sincronizar('cocal-2026')).rejects.toMatchObject({ codigo: 'resposta_vazia' });
  });
});

describe('FavoritosOffline', () => {
  it('sem rede, marca na hora e guarda na fila; com rede, envia e confirma com o servidor', async () => {
    const cofre = cofreEmMemoria();
    let online = false;
    const servidor = new Set<string>();
    const rede = requisitorFalso((c) => {
      if (!online) return offline();
      const id = c.caminho.split('/').pop() ?? '';
      if (c.metodo === 'PUT') servidor.add(id);
      if (c.metodo === 'DELETE') servidor.delete(id);
      return c.metodo === 'GET' ? { status: 200, dados: { atividades: [...servidor] } } : { status: 204 };
    });
    const f = new FavoritosOffline(rede.requisitar, cofre, 'cocal-2026');
    expect([...(await f.alternar('a1'))]).toEqual(['a1']);
    await f.alternar('a2');
    await f.alternar('a2');
    expect(f.pendentes).toBe(2);
    await expect(f.sincronizar()).rejects.toMatchObject({ codigo: 'sem_conexao' });

    const reaberto = new FavoritosOffline(rede.requisitar, cofre, 'cocal-2026');
    expect([...(await reaberto.carregar())]).toEqual(['a1']);
    expect(reaberto.pendentes).toBe(2);

    online = true;
    expect([...(await reaberto.sincronizar())]).toEqual(['a1']);
    expect(reaberto.pendentes).toBe(0);
    expect(rede.chamadas.filter((c) => c.metodo !== 'GET').map((c) => `${c.metodo} ${c.caminho}`).slice(-2))
      .toEqual(['PUT /favoritos/a1', 'DELETE /favoritos/a2']);
  });

  it('descarta pedido de atividade que saiu da agenda (404) e segue a fila', async () => {
    const rede = requisitorFalso((c) => (c.metodo === 'GET' ? { status: 200, dados: { atividades: ['a2'] } } : c.caminho.endsWith('a1') ? new ErroApi(404, 'atividade_inexistente', 'x') : { status: 204 }));
    const f = new FavoritosOffline(rede.requisitar, cofreEmMemoria(), 'cocal-2026');
    await f.alternar('a1');
    await f.alternar('a2');
    expect([...(await f.sincronizar())]).toEqual(['a2']);
  });

  it('erro do servidor (5xx) mantém a fila para depois', async () => {
    const f = new FavoritosOffline(requisitorFalso(() => new ErroApi(503, 'x', 'fora')).requisitar, cofreEmMemoria(), 'cocal-2026');
    await f.alternar('a1');
    await expect(f.sincronizar()).rejects.toMatchObject({ status: 503 });
    expect(f.pendentes).toBe(1);
  });
});

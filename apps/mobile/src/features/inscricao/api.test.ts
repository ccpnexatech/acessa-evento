import type { Requisitor } from '../../shared/api/cliente';
import { apiInscricao } from './api';
import { EVENTO, INGRESSO } from './fixtures';

function rede(dados: unknown) {
  const chamadas: { metodo: string; caminho: string; opcoes?: unknown }[] = [];
  const requisitar = (async (metodo: string, caminho: string, opcoes?: unknown) => {
    chamadas.push({ metodo, caminho, opcoes });
    return { status: 200, dados, etag: null };
  }) as Requisitor;
  return { api: apiInscricao(requisitar), chamadas };
}

describe('apiInscricao', () => {
  it('lista eventos com e sem filtro', async () => {
    const r = rede({ eventos: [EVENTO] });
    expect(await r.api.eventos()).toEqual([EVENTO]);
    await r.api.eventos('libras');
    expect(r.chamadas.map((c) => c.caminho)).toEqual(['/eventos', '/eventos?recurso=libras']);
  });

  it('manda a chave de idempotência no cabeçalho', async () => {
    const r = rede({ ingresso: INGRESSO });
    const pedido = { tipoIngressoId: 't1', recursos: [], metodo: 'pix' as const };
    expect(await r.api.inscrever('cocal-2026', 'chave-1', pedido)).toEqual(INGRESSO);
    expect(r.chamadas[0]).toEqual({ metodo: 'POST', caminho: '/eventos/cocal-2026/inscricoes', opcoes: { corpo: pedido, cabecalhos: { 'idempotency-key': 'chave-1' } } });
  });

  it('evento, ingressos e resposta vazia', async () => {
    expect(await rede(EVENTO).api.evento('cocal-2026')).toEqual(EVENTO);
    expect(await rede({ ingressos: [INGRESSO] }).api.ingressos()).toEqual([INGRESSO]);
    await expect(rede(undefined).api.evento('x')).rejects.toThrow('Resposta vazia');
  });
});
